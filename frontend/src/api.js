import { auth, logout } from './auth.js';

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('無法連線到伺服器');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 回應（例如 Nginx 502 頁面） */
  }

  if (!res.ok) {
    if (res.status === 401 && auth.token) logout();
    if ([502, 503, 504].includes(res.status)) throw new Error('此服務目前離線，請稍後再試');
    throw new Error(data?.error || `請求失敗（${res.status}）`);
  }
  return data;
}

function client(prefix) {
  return {
    get: (p) => request('GET', prefix + p),
    post: (p, b) => request('POST', prefix + p, b),
    put: (p, b) => request('PUT', prefix + p, b),
    del: (p) => request('DELETE', prefix + p),
  };
}

export const hqApi = client('/api/hq');
export const branchApi = (code) => client(`/api/branch/${encodeURIComponent(code)}`);

export const money = (n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
export const dateTime = (s) =>
  new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
