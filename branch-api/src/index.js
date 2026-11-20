const express = require('express');
const jwt = require('jsonwebtoken');
const { ensureDatabase, createPool, sleep } = require('./db');
const hq = require('./hq');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-jwt-secret';
const TZ = 'Asia/Taipei';

const BRANCH = {
  code: process.env.BRANCH_CODE,
  name: process.env.BRANCH_NAME,
  city: process.env.BRANCH_CITY,
  address: process.env.BRANCH_ADDRESS || '',
};
if (!/^[a-z0-9-]{2,40}$/.test(BRANCH.code || '') || !BRANCH.name || !BRANCH.city) {
  console.error('請設定環境變數 BRANCH_CODE（小寫英數與 -）、BRANCH_NAME、BRANCH_CITY');
  process.exit(1);
}
const DB_NAME = `branch_${BRANCH.code.replace(/-/g, '_')}`;

const SUGAR = ['正常糖', '少糖', '半糖', '微糖', '無糖'];
const ICE = ['正常冰', '少冰', '微冰', '去冰', '熱飲'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS special_drinks (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  price       INTEGER      NOT NULL CHECK (price >= 0),
  description TEXT         NOT NULL DEFAULT '',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  total      INTEGER     NOT NULL,
  items      JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced     BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_orders_unsynced ON orders (id) WHERE NOT synced;

-- 總部共用菜單的本地快取：總部連不上時，分店仍可照常營業
CREATE TABLE IF NOT EXISTS kv_cache (
  key        VARCHAR(50) PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const toInt = (v) => Number.parseInt(v, 10);

function validDrink(body) {
  const name = String(body.name || '').trim();
  const price = toInt(body.price);
  if (!name || name.length > 100) return { error: '請輸入飲品名稱（100 字以內）' };
  if (!Number.isInteger(price) || price < 0 || price > 10000) return { error: '價格需為 0 ~ 10000 的整數' };
  return {
    name,
    price,
    description: String(body.description || '').trim().slice(0, 500),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

// 店長只能管理自己的分店；總部 admin 可以管理所有分店
function requireStaff(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
  const { role, branchCode } = req.user;
  if (role === 'admin' || (role === 'manager' && branchCode === BRANCH.code)) return next();
  res.status(403).json({ error: '你沒有此分店的管理權限' });
}

async function main() {
  await ensureDatabase(DB_NAME);
  const pool = createPool(DB_NAME);
  await pool.query(SCHEMA);

  // ---------- 與總部的連線 ----------
  let hqOnline = false;

  async function getCommonMenu() {
    try {
      const drinks = await hq.get('/api/menu');
      hqOnline = true;
      await pool.query(
        `INSERT INTO kv_cache (key, value, updated_at) VALUES ('common_menu', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [JSON.stringify(drinks)]
      );
      return drinks;
    } catch (err) {
      hqOnline = false;
      console.warn(`[menu] 無法連線總部，改用快取菜單：${err.message}`);
      const r = await pool.query("SELECT value FROM kv_cache WHERE key = 'common_menu'");
      return r.rows[0]?.value || [];
    }
  }

  async function heartbeat() {
    try {
      await hq.post('/api/internal/branches/register', BRANCH);
      hqOnline = true;
      return true;
    } catch (err) {
      hqOnline = false;
      console.warn(`[hq] 心跳失敗：${err.message}`);
      return false;
    }
  }

  // 把還沒同步的訂單送到總部；總部端用 (branch_code, order_id) 去重，所以重送也安全
  let syncing = false;
  async function syncOrders() {
    if (syncing) return;
    syncing = true;
    try {
      const r = await pool.query(
        'SELECT id, total, items, created_at FROM orders WHERE NOT synced ORDER BY id LIMIT 100'
      );
      if (r.rowCount === 0) return;
      const result = await hq.post('/api/internal/sales', {
        branchCode: BRANCH.code,
        orders: r.rows.map((o) => ({ id: o.id, total: o.total, items: o.items, createdAt: o.created_at })),
      });
      await pool.query('UPDATE orders SET synced = TRUE WHERE id = ANY($1::int[])', [result.accepted]);
      console.log(`[sync] 已同步 ${result.accepted.length} 筆訂單到總部`);
    } catch (err) {
      console.warn(`[sync] 同步失敗，稍後重試：${err.message}`);
    } finally {
      syncing = false;
    }
  }

  // ---------- API ----------
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'branch-api', branch: BRANCH.code }));

  app.get('/api/info', (req, res) => res.json(BRANCH));

  // 分店菜單 = 總部共用菜單 + 本店特色飲品
  app.get('/api/menu', async (req, res) => {
    const common = await getCommonMenu();
    const specials = await pool.query(
      'SELECT id, name, price, description FROM special_drinks WHERE is_active ORDER BY id'
    );
    res.json({ branch: BRANCH, hqOnline, common, specials: specials.rows, sugarOptions: SUGAR, iceOptions: ICE });
  });

  // 顧客下單：價格一律以伺服器端菜單為準
  app.post('/api/orders', async (req, res) => {
    const input = Array.isArray(req.body?.items) ? req.body.items : [];
    if (input.length === 0 || input.length > 30) return res.status(400).json({ error: '購物車是空的或品項過多' });

    const common = await getCommonMenu();
    const specials = (await pool.query('SELECT id, name, price FROM special_drinks WHERE is_active')).rows;
    const lookup = { common: new Map(common.map((d) => [d.id, d])), special: new Map(specials.map((d) => [d.id, d])) };

    const items = [];
    for (const it of input) {
      const drink = lookup[it.source]?.get(toInt(it.drinkId));
      const qty = toInt(it.qty);
      if (!drink) return res.status(400).json({ error: '菜單已更新，部分品項不存在，請重新整理' });
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) return res.status(400).json({ error: '數量需為 1 ~ 50' });
      if (!SUGAR.includes(it.sugar) || !ICE.includes(it.ice)) return res.status(400).json({ error: '甜度或冰塊選項不正確' });
      items.push({ source: it.source, drinkId: drink.id, name: drink.name, price: drink.price, qty, sugar: it.sugar, ice: it.ice });
    }
    const total = items.reduce((a, i) => a + i.price * i.qty, 0);
    const r = await pool.query('INSERT INTO orders (total, items) VALUES ($1, $2) RETURNING id, created_at', [
      total,
      JSON.stringify(items),
    ]);
    syncOrders(); // 立即嘗試同步，不等待
    res.status(201).json({ orderId: r.rows[0].id, total, createdAt: r.rows[0].created_at });
  });

  // ---------- 店長後台 ----------
  app.get('/api/admin/specials', requireStaff, async (req, res) => {
    const r = await pool.query(
      'SELECT id, name, price, description, is_active AS "isActive", created_at AS "createdAt" FROM special_drinks ORDER BY id'
    );
    res.json(r.rows);
  });

  app.post('/api/admin/specials', requireStaff, async (req, res) => {
    const d = validDrink(req.body || {});
    if (d.error) return res.status(400).json(d);
    const r = await pool.query(
      'INSERT INTO special_drinks (name, price, description, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
      [d.name, d.price, d.description, d.isActive]
    );
    res.status(201).json({ id: r.rows[0].id });
  });

  app.put('/api/admin/specials/:id', requireStaff, async (req, res) => {
    const d = validDrink(req.body || {});
    if (d.error) return res.status(400).json(d);
    const r = await pool.query(
      'UPDATE special_drinks SET name = $1, price = $2, description = $3, is_active = $4 WHERE id = $5',
      [d.name, d.price, d.description, d.isActive, toInt(req.params.id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: '找不到此飲品' });
    res.json({ ok: true });
  });

  app.delete('/api/admin/specials/:id', requireStaff, async (req, res) => {
    const r = await pool.query('DELETE FROM special_drinks WHERE id = $1', [toInt(req.params.id)]);
    if (r.rowCount === 0) return res.status(404).json({ error: '找不到此飲品' });
    res.json({ ok: true });
  });

  app.get('/api/admin/orders', requireStaff, async (req, res) => {
    const limit = Math.min(Math.max(toInt(req.query.limit) || 20, 1), 200);
    const r = await pool.query(
      'SELECT id, total, items, created_at AS "createdAt", synced FROM orders ORDER BY id DESC LIMIT $1',
      [limit]
    );
    res.json(r.rows);
  });

  // 店長看到的經營資訊：直接查本店資料庫，總部斷線也看得到
  app.get('/api/admin/stats', requireStaff, async (req, res) => {
    const days = Math.min(Math.max(toInt(req.query.days) || 7, 1), 90);
    const summary = await pool.query(
      `SELECT COALESCE(SUM(total), 0)::int AS "totalRevenue",
              COUNT(*)::int                AS "totalOrders",
              COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date), 0)::int AS "todayRevenue",
              COUNT(*)            FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date)::int     AS "todayOrders",
              COUNT(*)            FILTER (WHERE NOT synced)::int AS "unsynced"
         FROM orders`,
      [TZ]
    );
    const daily = await pool.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              COALESCE(SUM(o.total), 0)::int AS revenue,
              COUNT(o.id)::int AS orders
         FROM generate_series((now() AT TIME ZONE $1)::date - ($2::int - 1), (now() AT TIME ZONE $1)::date, interval '1 day') AS d
         LEFT JOIN orders o ON (o.created_at AT TIME ZONE $1)::date = d::date
        GROUP BY d ORDER BY d`,
      [TZ, days]
    );
    const topDrinks = await pool.query(
      `SELECT item->>'name' AS name,
              SUM((item->>'qty')::int)::int AS qty,
              SUM((item->>'qty')::int * (item->>'price')::int)::int AS revenue
         FROM orders, jsonb_array_elements(items) AS item
        GROUP BY item->>'name'
        ORDER BY qty DESC
        LIMIT 10`
    );
    res.json({ branch: BRANCH, hqOnline, summary: summary.rows[0], daily: daily.rows, topDrinks: topDrinks.rows });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  });

  app.listen(PORT, () => console.log(`[branch-api:${BRANCH.code}] listening on :${PORT}`));

  // 背景工作：向總部註冊 / 心跳（30 秒）、訂單同步（10 秒）
  (async () => {
    for (let i = 1; !(await heartbeat()) && i < 30; i++) await sleep(2000);
    await syncOrders();
  })();
  setInterval(heartbeat, 30_000);
  setInterval(syncOrders, 10_000);
}

main().catch((err) => {
  console.error('[branch-api] 啟動失敗', err);
  process.exit(1);
});
