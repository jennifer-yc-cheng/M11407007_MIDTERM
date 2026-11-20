// 呼叫總部服務的 client
const HQ_URL = process.env.HQ_URL || 'http://hq-api:3000';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'please-change-this-internal-token';

async function call(method, path, body) {
  const res = await fetch(HQ_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`HQ ${method} ${path} -> ${res.status}`);
  return res.json();
}

module.exports = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body),
};
