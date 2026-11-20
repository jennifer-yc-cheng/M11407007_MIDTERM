<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { branchApi, money, dateTime } from '../api.js';
import BarList from '../components/BarList.vue';
import DailyChart from '../components/DailyChart.vue';
import DrinkEditor from '../components/DrinkEditor.vue';

const route = useRoute();
const code = route.params.code;
const api = branchApi(code);

const stats = ref(null);
const specials = ref([]);
const orders = ref([]);
const error = ref('');
const notice = ref('');

const topRows = computed(() =>
  (stats.value?.topDrinks || []).map((d) => ({ label: d.name, value: d.qty, display: `${d.qty} 杯` }))
);

async function load() {
  try {
    [stats.value, specials.value, orders.value] = await Promise.all([
      api.get('/admin/stats?days=7'),
      api.get('/admin/specials'),
      api.get('/admin/orders?limit=20'),
    ]);
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}

async function run(action, msg) {
  try {
    await action();
    notice.value = msg;
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

const createSpecial = (d) => run(() => api.post('/admin/specials', d), `已新增特色飲品「${d.name}」`);
const updateSpecial = (d) => run(() => api.put(`/admin/specials/${d.id}`, d), `已更新「${d.name}」`);
const removeSpecial = (id) => run(() => api.del(`/admin/specials/${id}`), '已刪除特色飲品');

const summarize = (items) => items.map((i) => `${i.name}×${i.qty}`).join('、');

onMounted(load);
</script>

<template>
  <div v-if="error" class="alert error">{{ error }}</div>
  <p v-if="!stats && !error" class="muted">載入中…</p>

  <template v-if="stats">
    <div class="head">
      <div>
        <span class="badge">{{ stats.branch.city }}</span>
        <h1>{{ stats.branch.name }}・分店後台</h1>
      </div>
      <div class="head-actions">
        <span class="badge" :class="stats.hqOnline ? 'ok' : 'off'"><span class="dot"></span>{{ stats.hqOnline ? '已連線總部' : '總部離線' }}</span>
        <RouterLink :to="`/${code}`" class="btn ghost small">前往點餐頁</RouterLink>
        <button class="btn ghost small" @click="load">重新整理</button>
      </div>
    </div>

    <div v-if="notice" class="alert success">{{ notice }}</div>

    <section class="stats section">
      <div class="stat"><div class="label">今日營收</div><div class="value">{{ money(stats.summary.todayRevenue) }}</div></div>
      <div class="stat"><div class="label">今日訂單</div><div class="value">{{ stats.summary.todayOrders }}</div></div>
      <div class="stat"><div class="label">累計營收</div><div class="value">{{ money(stats.summary.totalRevenue) }}</div><div class="sub">共 {{ stats.summary.totalOrders }} 筆訂單</div></div>
      <div class="stat"><div class="label">待同步至總部</div><div class="value">{{ stats.summary.unsynced }}</div><div class="sub">每 10 秒自動同步</div></div>
    </section>

    <section class="grid grid-2 section">
      <div class="card">
        <h2>近 7 日營收</h2>
        <DailyChart :daily="stats.daily" />
      </div>
      <div class="card">
        <h2>熱銷品項（杯數）</h2>
        <BarList :rows="topRows" empty="還沒有訂單" />
      </div>
    </section>

    <section class="card section">
      <div class="section-title">
        <h2>本店特色飲品</h2>
        <span class="muted">只會出現在本店菜單；經典飲品由總部統一管理</span>
      </div>
      <DrinkEditor :items="specials" allow-delete add-label="新增特色飲品"
        @create="createSpecial" @update="updateSpecial" @remove="removeSpecial" />
    </section>

    <section class="card section">
      <h2>最近訂單</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>時間</th><th>內容</th><th class="num">金額</th><th>總部同步</th></tr></thead>
          <tbody>
            <tr v-for="o in orders" :key="o.id">
              <td>{{ o.id }}</td>
              <td class="nowrap">{{ dateTime(o.createdAt) }}</td>
              <td>{{ summarize(o.items) }}</td>
              <td class="num">{{ money(o.total) }}</td>
              <td><span class="badge" :class="o.synced ? 'ok' : 'off'">{{ o.synced ? '已同步' : '待同步' }}</span></td>
            </tr>
            <tr v-if="!orders.length"><td colspan="5" class="muted">還沒有訂單</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.head h1 { margin: 8px 0 0; }
.head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.nowrap { white-space: nowrap; }
</style>
