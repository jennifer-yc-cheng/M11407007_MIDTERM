const { Pool, Client } = require('pg');

const baseConfig = {
  host: process.env.PGHOST || 'postgres',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'drink',
  password: process.env.PGPASSWORD || 'drink123',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 確保分店自己的資料庫存在（不存在就建立）。多個分店同時啟動時 CREATE DATABASE 可能互相衝突，所以會重試。
async function ensureDatabase(name) {
  for (let attempt = 1; ; attempt++) {
    const client = new Client({ ...baseConfig, database: 'postgres' });
    try {
      await client.connect();
      const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (r.rowCount === 0) {
        await client.query(`CREATE DATABASE "${name}"`);
        console.log(`[db] 已建立資料庫 ${name}`);
      }
      await client.end();
      return;
    } catch (err) {
      await client.end().catch(() => {});
      if (attempt >= 30) throw err;
      console.log(`[db] 等待 PostgreSQL 中 (${attempt}/30)：${err.message}`);
      await sleep(1000 + Math.random() * 2000);
    }
  }
}

function createPool(database) {
  return new Pool({ ...baseConfig, database, max: 5 });
}

module.exports = { ensureDatabase, createPool, sleep };
