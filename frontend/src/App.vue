<script setup>
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, logout } from './auth.js';

const route = useRoute();
const router = useRouter();

function doLogout() {
  logout();
  router.push('/');
}

// 登入過期（API 回 401 被登出）時，若正在後台頁面就導回登入頁
watch(
  () => auth.user,
  (user) => {
    if (!user && (route.meta.admin || route.meta.staff)) {
      router.push({ path: '/login', query: { redirect: route.fullPath } });
    }
  }
);
</script>

<template>
  <RouterView v-if="route.meta.kiosk" :key="route.fullPath" />

  <template v-else>
  <header class="topbar">
    <div class="container bar">
      <RouterLink to="/" class="logo">
        <span class="logo-mark">茶</span>
        <span>開心茶飲 <small>Happy Tea</small></span>
      </RouterLink>
      <nav>
        <RouterLink to="/">分店</RouterLink>
        <RouterLink v-if="auth.user?.role === 'admin'" to="/hq">總部後台</RouterLink>
        <RouterLink v-if="auth.user?.role === 'manager'" :to="`/${auth.user.branchCode}/admin`">我的分店後台</RouterLink>
        <template v-if="auth.user">
          <span class="who">{{ auth.user.displayName }}</span>
          <button class="btn ghost small" @click="doLogout">登出</button>
        </template>
        <RouterLink v-else to="/login" class="btn small login">管理登入</RouterLink>
      </nav>
    </div>
  </header>

  <main class="container page">
    <RouterView :key="$route.fullPath" />
  </main>

  <footer class="footer">
    <div class="container muted">© 開心茶飲 Happy Tea 連鎖品牌 · 分散式分店系統</div>
  </footer>
  </template>
</template>

<style scoped>
.topbar { background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; flex-wrap: wrap; padding-block: 8px; }
.logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; color: var(--ink); text-decoration: none; }
.logo small { color: var(--muted); font-weight: 400; font-size: 0.8rem; }
.logo-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--brand); color: #fff; display: grid; place-items: center; }
nav { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 0.95rem; }
nav a.router-link-exact-active:not(.btn) { font-weight: 700; }
.login { color: #fff; text-decoration: none; }
.who { color: var(--ink-2); font-size: 0.9rem; }
.footer { border-top: 1px solid var(--line); padding-block: 20px; font-size: 0.85rem; }
</style>
