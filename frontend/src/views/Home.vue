<script setup>
import { computed, onMounted, ref } from 'vue';
import { hqApi } from '../api.js';

const branches = ref([]);
const error = ref('');
const loading = ref(true);

const byCity = computed(() => {
  const groups = new Map();
  for (const b of branches.value) {
    if (!groups.has(b.city)) groups.set(b.city, []);
    groups.get(b.city).push(b);
  }
  return [...groups.entries()];
});

onMounted(async () => {
  try {
    branches.value = await hqApi.get('/branches');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="hero">
    <h1>開心茶飲，每一間都有自己的味道</h1>
    <p>全台分店供應相同的經典飲品，每間分店另有自己開發的特色飲品。請選擇分店開始點餐。</p>
  </section>

  <div v-if="error" class="alert error">無法取得分店列表：{{ error }}</div>
  <p v-else-if="loading" class="muted">載入中…</p>
  <p v-else-if="!branches.length" class="muted">目前還沒有分店上線。</p>

  <section v-for="[city, list] in byCity" :key="city" class="section">
    <h2>{{ city }}</h2>
    <div class="grid grid-cards">
      <RouterLink v-for="b in list" :key="b.code" :to="`/${b.code}`" class="card branch">
        <div class="row">
          <h3>{{ b.name }}</h3>
          <span class="badge" :class="b.online ? 'ok' : 'off'"><span class="dot"></span>{{ b.online ? '營業中' : '離線' }}</span>
        </div>
        <p class="muted">{{ b.address || '—' }}</p>
        <span class="go">查看菜單 →</span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.hero { padding: 28px; border-radius: var(--radius); background: linear-gradient(135deg, var(--brand-soft), #fff); border: 1px solid var(--line); }
.hero p { color: var(--ink-2); margin: 0; max-width: 40em; }
.branch { display: block; color: var(--ink); text-decoration: none; transition: transform 0.1s, border-color 0.1s; }
.branch:hover { transform: translateY(-2px); border-color: var(--brand); text-decoration: none; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.row h3 { margin: 0; }
.go { color: var(--brand); font-size: 0.9rem; }
</style>
