import { reactive } from 'vue';

function load() {
  try {
    return JSON.parse(localStorage.getItem('auth') || 'null') || {};
  } catch {
    return {};
  }
}

const saved = load();
export const auth = reactive({ token: saved.token || null, user: saved.user || null });

export function setAuth(token, user) {
  auth.token = token;
  auth.user = user;
  try {
    localStorage.setItem('auth', JSON.stringify({ token, user }));
  } catch {
    /* 無法使用 localStorage 時只保留在記憶體 */
  }
}

export function logout() {
  auth.token = null;
  auth.user = null;
  try {
    localStorage.removeItem('auth');
  } catch {
    /* ignore */
  }
}
