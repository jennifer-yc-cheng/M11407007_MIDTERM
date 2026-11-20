<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { hqApi } from '../api.js';
import { setAuth } from '../auth.js';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const { token, user } = await hqApi.post('/auth/login', { username: username.value, password: password.value });
    setAuth(token, user);
    const fallback = user.role === 'admin' ? '/hq' : `/${user.branchCode}/admin`;
    router.replace(route.query.redirect || fallback);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="wrap">
    <form class="card" @submit.prevent="submit">
      <h1>管理登入</h1>
      <p class="muted">總部與各分店店長共用同一個登入入口。</p>
      <div v-if="error" class="alert error">{{ error }}</div>
      <label class="field"><span>帳號</span><input v-model="username" autocomplete="username" required /></label>
      <label class="field"><span>密碼</span><input v-model="password" type="password" autocomplete="current-password" required /></label>
      <button class="btn full" :disabled="busy">{{ busy ? '登入中…' : '登入' }}</button>
      <div class="hint muted">
        示範帳號：總部 <code>admin</code> / <code>admin123</code>；
        店長 <code>&lt;分店代碼&gt;-manager</code> / <code>manager123</code>（例如 <code>taipei-manager</code>）
      </div>
    </form>
  </div>
</template>

<style scoped>
.wrap { max-width: 420px; margin: 32px auto; }
.full { width: 100%; margin-top: 4px; }
.hint { margin-top: 16px; font-size: 0.82rem; line-height: 1.6; }
code { background: var(--brand-soft); padding: 1px 5px; border-radius: 4px; }
</style>
