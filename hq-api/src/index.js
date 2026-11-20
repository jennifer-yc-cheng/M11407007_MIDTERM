const express = require('express');
const bcrypt = require('bcryptjs');
const { ensureDatabase, createPool } = require('./db');
const { signToken, requireAuth, requireRole, requireInternal } = require('./auth');

const PORT = Number(process.env.PORT || 3000);
const DB_NAME = process.env.HQ_DB_NAME || 'hq_db';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DEFAULT_MANAGER_PASSWORD = process.env.DEFAULT_MANAGER_PASSWORD || 'manager123';
const TZ = 'Asia/Taipei';
const ONLINE_SECONDS = 90; // 分店超過 90 秒沒回報心跳就視為離線

const SCHEMA = `
CREATE TABLE IF NOT EXISTS branches (
  code          VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  city          VARCHAR(40)  NOT NULL,
  address       VARCHAR(200) NOT NULL DEFAULT '',
  registered_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'manager')),
  branch_code   VARCHAR(40)  REFERENCES branches(code)
);

CREATE TABLE IF NOT EXISTS common_drinks (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  price       INTEGER      NOT NULL CHECK (price >= 0),
  description TEXT         NOT NULL DEFAULT '',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id          BIGSERIAL PRIMARY KEY,
  branch_code VARCHAR(40) NOT NULL REFERENCES branches(code),
  order_id    INTEGER     NOT NULL,
  total       INTEGER     NOT NULL,
  item_count  INTEGER     NOT NULL,
  items       JSONB       NOT NULL,
  ordered_at  TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_code, order_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_branch_time ON sales (branch_code, ordered_at);
`;

const DEFAULT_DRINKS = [
  ['開心奶茶', 70, '香濃奶茶，喝了就開心'],
  ['快樂紅茶', 55, '經典錫蘭紅茶，清爽回甘'],
  ['烏龍綠茶', 60, '烏龍與綠茶的雙重茶香'],
  ['茉莉花茶', 70, '淡雅茉莉花香'],
  ['甘蔗青茶', 65, '天然甘蔗搭配青茶'],
];

async function seed(pool) {
  const drinks = await pool.query('SELECT COUNT(*)::int AS n FROM common_drinks');
  if (drinks.rows[0].n === 0) {
    for (const [i, [name, price, desc]] of DEFAULT_DRINKS.entries()) {
      await pool.query(
        'INSERT INTO common_drinks (name, price, description, sort_order) VALUES ($1, $2, $3, $4)',
        [name, price, desc, i + 1]
      );
    }
    console.log('[seed] 已建立 5 款共用飲品');
  }
  const admin = await pool.query("SELECT 1 FROM users WHERE username = 'admin'");
  if (admin.rowCount === 0) {
    await pool.query(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin', $1, '總部老闆', 'admin')",
      [await bcrypt.hash(ADMIN_PASSWORD, 10)]
    );
    console.log('[seed] 已建立總部帳號 admin');
  }
}

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

async function main() {
  await ensureDatabase(DB_NAME);
  const pool = createPool(DB_NAME);
  await pool.query(SCHEMA);
  await seed(pool);

  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'hq-api' }));

  // ---------- 登入（帳號統一由總部管理） ----------
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const r = await pool.query('SELECT * FROM users WHERE username = $1', [String(username || '')]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    res.json({
      token: signToken(user),
      user: {
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        branchCode: user.branch_code,
      },
    });
  });

  // ---------- 公開資料 ----------
  app.get('/api/branches', async (req, res) => {
    const r = await pool.query(
      `SELECT code, name, city, address,
              (last_seen_at > now() - make_interval(secs => $1)) AS online
         FROM branches ORDER BY registered_at, code`,
      [ONLINE_SECONDS]
    );
    res.json(r.rows.map((b) => ({ ...b, online: Boolean(b.online) })));
  });

  // 全分店共用菜單（分店服務也從這裡取得）
  app.get('/api/menu', async (req, res) => {
    const r = await pool.query(
      'SELECT id, name, price, description FROM common_drinks WHERE is_active ORDER BY sort_order, id'
    );
    res.json(r.rows);
  });

  // ---------- 總部後台（僅 admin） ----------
  const admin = [requireAuth, requireRole('admin')];

  app.get('/api/admin/menu', admin, async (req, res) => {
    const r = await pool.query(
      'SELECT id, name, price, description, is_active AS "isActive", sort_order AS "sortOrder" FROM common_drinks ORDER BY sort_order, id'
    );
    res.json(r.rows);
  });

  app.post('/api/admin/menu', admin, async (req, res) => {
    const d = validDrink(req.body || {});
    if (d.error) return res.status(400).json(d);
    const r = await pool.query(
      `INSERT INTO common_drinks (name, price, description, is_active, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM common_drinks))
       RETURNING id`,
      [d.name, d.price, d.description, d.isActive]
    );
    res.status(201).json({ id: r.rows[0].id });
  });

  app.put('/api/admin/menu/:id', admin, async (req, res) => {
    const d = validDrink(req.body || {});
    if (d.error) return res.status(400).json(d);
    const r = await pool.query(
      'UPDATE common_drinks SET name = $1, price = $2, description = $3, is_active = $4 WHERE id = $5',
      [d.name, d.price, d.description, d.isActive, toInt(req.params.id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: '找不到此飲品' });
    res.json({ ok: true });
  });

  app.get('/api/admin/stats', admin, async (req, res) => {
    const days = Math.min(Math.max(toInt(req.query.days) || 7, 1), 90);

    const branches = await pool.query(
      `SELECT b.code, b.name, b.city, b.last_seen_at AS "lastSeenAt",
              (b.last_seen_at > now() - make_interval(secs => $2)) AS online,
              COALESCE(SUM(s.total), 0)::int AS "totalRevenue",
              COUNT(s.id)::int               AS "totalOrders",
              COALESCE(SUM(s.total) FILTER (WHERE (s.ordered_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date), 0)::int AS "todayRevenue",
              COUNT(s.id)           FILTER (WHERE (s.ordered_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date)::int     AS "todayOrders"
         FROM branches b
         LEFT JOIN sales s ON s.branch_code = b.code
        GROUP BY b.code
        ORDER BY b.registered_at, b.code`,
      [TZ, ONLINE_SECONDS]
    );

    const daily = await pool.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              COALESCE(SUM(s.total), 0)::int AS revenue,
              COUNT(s.id)::int AS orders
         FROM generate_series((now() AT TIME ZONE $1)::date - ($2::int - 1), (now() AT TIME ZONE $1)::date, interval '1 day') AS d
         LEFT JOIN sales s ON (s.ordered_at AT TIME ZONE $1)::date = d::date
        GROUP BY d ORDER BY d`,
      [TZ, days]
    );

    const topDrinks = await pool.query(
      `SELECT item->>'name' AS name,
              SUM((item->>'qty')::int)::int AS qty,
              SUM((item->>'qty')::int * (item->>'price')::int)::int AS revenue
         FROM sales, jsonb_array_elements(items) AS item
        GROUP BY item->>'name'
        ORDER BY qty DESC
        LIMIT 10`
    );

    const rows = branches.rows.map((b) => ({ ...b, online: Boolean(b.online) }));
    const sum = (k) => rows.reduce((a, b) => a + b[k], 0);
    res.json({
      summary: {
        branchCount: rows.length,
        onlineCount: rows.filter((b) => b.online).length,
        totalRevenue: sum('totalRevenue'),
        totalOrders: sum('totalOrders'),
        todayRevenue: sum('todayRevenue'),
        todayOrders: sum('todayOrders'),
      },
      branches: rows,
      daily: daily.rows,
      topDrinks: topDrinks.rows,
    });
  });

  app.get('/api/admin/sales', admin, async (req, res) => {
    const limit = Math.min(Math.max(toInt(req.query.limit) || 30, 1), 200);
    const branch = req.query.branch ? String(req.query.branch) : null;
    const r = await pool.query(
      `SELECT s.id, s.branch_code AS "branchCode", b.name AS "branchName", s.order_id AS "orderId",
              s.total, s.item_count AS "itemCount", s.items, s.ordered_at AS "orderedAt"
         FROM sales s JOIN branches b ON b.code = s.branch_code
        WHERE ($1::text IS NULL OR s.branch_code = $1)
        ORDER BY s.ordered_at DESC
        LIMIT $2`,
      [branch, limit]
    );
    res.json(r.rows);
  });

  // ---------- 內部 API：分店服務 → 總部 ----------
  // 分店啟動時註冊，之後每 30 秒呼叫一次當作心跳
  app.post('/api/internal/branches/register', requireInternal, async (req, res) => {
    const { code, name, city, address } = req.body || {};
    if (!/^[a-z0-9-]{2,40}$/.test(String(code || '')) || !name || !city) {
      return res.status(400).json({ error: 'code / name / city 不正確' });
    }
    await pool.query(
      `INSERT INTO branches (code, name, city, address, last_seen_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address, last_seen_at = now()`,
      [code, name, city, address || '']
    );
    // 每間分店自動建立一個店長帳號（加盟店長登入用）
    const username = `${code}-manager`;
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rowCount === 0) {
      await pool.query(
        "INSERT INTO users (username, password_hash, display_name, role, branch_code) VALUES ($1, $2, $3, 'manager', $4)",
        [username, await bcrypt.hash(DEFAULT_MANAGER_PASSWORD, 10), `${name} 店長`, code]
      );
      console.log(`[branch] 新分店 ${code}，已建立店長帳號 ${username}`);
    }
    res.json({ ok: true });
  });

  // 分店把訂單同步到總部（可重送，不會重複計算）
  app.post('/api/internal/sales', requireInternal, async (req, res) => {
    const { branchCode, orders } = req.body || {};
    if (!branchCode || !Array.isArray(orders)) return res.status(400).json({ error: 'bad payload' });
    const accepted = [];
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      await pool.query(
        `INSERT INTO sales (branch_code, order_id, total, item_count, items, ordered_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (branch_code, order_id) DO NOTHING`,
        [branchCode, o.id, o.total, items.reduce((a, i) => a + (Number(i.qty) || 0), 0), JSON.stringify(items), o.createdAt]
      );
      accepted.push(o.id);
    }
    res.json({ accepted });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  });

  app.listen(PORT, () => console.log(`[hq-api] listening on :${PORT}`));
}

main().catch((err) => {
  console.error('[hq-api] 啟動失敗', err);
  process.exit(1);
});
