import { auth, logout } from './auth.js';

async function request(method, url, body) {
  const isBlob = body instanceof Blob;
  const headers = { 'Content-Type': isBlob ? body.type : 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: isBlob ? body : body ? JSON.stringify(body) : undefined });
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
    put: (p, b) => request('PUT', prefix + p, b), // b 可以是 JSON 物件或圖片 Blob
    del: (p) => request('DELETE', prefix + p),
  };
}

export const hqApi = client('/api/hq');
export const branchApi = (code) => client(`/api/branch/${encodeURIComponent(code)}`);

// 上傳前在瀏覽器端把照片縮到最長邊 800px、轉成 JPEG（手機照片通常從數 MB 變成約 100KB）
export async function compressImage(file, maxSize = 800, quality = 0.85) {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('無法讀取這張圖片，請改用 JPG 或 PNG');
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 透明背景（PNG）轉 JPEG 時補白底
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片處理失敗'))), 'image/jpeg', quality)
  );
}

export const money =(n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
export const dateTime = (s) =>
  new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
