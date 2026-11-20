<script setup>
import { computed, onMounted, ref } from 'vue';
import { hqApi, money, dateTime } from '../api.js';
import BarList from '../components/BarList.vue';
import DailyChart from '../components/DailyChart.vue';
import DrinkEditor from '../components/DrinkEditor.vue';

const stats = ref(null);
const menu = ref([]);
const sales = ref([]);
const salesBranch = ref('');
const error = ref('');
const notice = ref('');

const branchRows = computed(() =>
  (stats.value?.branches || []).map((b) => ({ label: b.name, value: b.totalRevenue, display: money(b.totalRevenue) }))
);
const topRows = computed(() =>
  (stats.value?.topDrinks || []).map((d) => ({ label: d.name, value: d.qty, display: `${d.qty} 杯` }))
);

async function loadSales() {
  const q = salesBranch.value ? `&branch=${encodeURIComponent(salesBranch.value)}` : '';
  sales.value = await hqApi.get(`/admin/sales?limit=30${q}`);
}

async function load() {
  try {
    [stats.value, menu.value] = await Promise.all([hqApi.get('/admin/stats?days=7'), hqApi.get('/admin/menu')]);
    await loadSales();
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

const createDrink = (d) => run(() => hqApi.post('/admin/menu', d), `已新增經典飲品「${d.name}」，所有分店同步更新`);
const updateDrink = (d) => run(() => hqApi.put(`/admin/menu/${d.id}`, d), `已更新「${d.name}」，所有分店同步更新`);

const summarize = (items) => items.map((i) => `${i.name}×${i.qty}`).join('、');

onMounted(load);
</script>

<template>
  <div v-if="error" class="alert error">{{ error }}</div>
  <p v-if="!stats && !error" class="muted">載入中…</p>

  <template v-if="stats">
    <div class="head">
      <h1>總部後台</h1>
      <button class="btn ghost small" @click="load">重新整理</button>
    </div>
    <div v-if="notice" class="alert success">{{ notice }}</div>

    <section class="stats section">
      <div class="stat"><div class="label">全品牌今日營收</div><div class="value">{{ money(stats.summary.todayRevenue) }}</div><div class="sub">{{ stats.summary.todayOrders }} 筆訂單</div></div>
      <div class="stat"><div class="label">全品牌累計營收</div><div class="value">{{ money(stats.summary.totalRevenue) }}</div><div class="sub">{{ stats.summary.totalOrders }} 筆訂單</div></div>
      <div class="stat"><div class="label">分店數</div><div class="value">{{ stats.summary.branchCount }}</div><div class="sub">{{ stats.summary.onlineCount }} 間在線</div></div>
    </section>

    <section class="card section">
      <h2>各分店經營概況</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>分店</th><th>城市</th><th>狀態</th><th class="num">今日營收</th><th class="num">今日訂單</th><th class="num">累計營收</th><th class="num">累計訂單</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="b in stats.branches" :key="b.code">
              <td><strong>{{ b.name }}</strong><div class="muted small">{{ b.code }}</div></td>
              <td>{{ b.city }}</td>
              <td>
                <span class="badge" :class="b.online ? 'ok' : 'off'" :title="b.lastSeenAt ? '最後回報：' + dateTime(b.lastSeenAt) : ''">
                  <span class="dot"></span>{{ b.online ? '在線' : '離線' }}
                </span>
              </td>
              <td class="num">{{ money(b.todayRevenue) }}</td>
              <td class="num">{{ b.todayOrders }}</td>
              <td class="num">{{ money(b.totalRevenue) }}</td>
              <td class="num">{{ b.totalOrders }}</td>
              <td class="links"><RouterLink :to="`/${b.code}`">菜單</RouterLink> · <RouterLink :to="`/${b.code}/admin`">分店後台</RouterLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid grid-2 section">
      <div class="card">
        <h2>各分店累計營收</h2>
        <BarList :rows="branchRows" />
      </div>
      <div class="card">
        <h2>全品牌近 7 日營收</h2>
        <DailyChart :daily="stats.daily" />
      </div>
    </section>

    <section class="card section">
      <h2>全品牌熱銷品項（杯數）</h2>
      <BarList :rows="topRows" empty="還沒有訂單" />
    </section>

    <section class="card section">
      <div class="section-title">
        <h2>經典飲品（全分店共用菜單）</h2>
        <span class="muted">在這裡修改後，所有分店的菜單會同步更新</span>
      </div>
      <DrinkEditor :items="menu" add-label="新增經典飲品" @create="createDrink" @update="updateDrink" />
    </section>

    <section class="card section">
      <div class="section-title">
        <h2>最新同步的訂單</h2>
        <select v-model="salesBranch" class="filter" @change="loadSales">
          <option value="">全部分店</option>
          <option v-for="b in stats.branches" :key="b.code" :value="b.code">{{ b.name }}</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>分店</th><th>分店訂單 #</th><th>時間</th><th>內容</th><th class="num">金額</th></tr></thead>
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>{{ s.branchName }}</td>
              <td>{{ s.orderId }}</td>
              <td class="nowrap">{{ dateTime(s.orderedAt) }}</td>
              <td>{{ summarize(s.items) }}</td>
              <td class="num">{{ money(s.total) }}</td>
            </tr>
            <tr v-if="!sales.length"><td colspan="5" class="muted">尚無資料</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.head h1 { margin: 0; }
.small { font-size: 0.78rem; }
.links, .nowrap { white-space: nowrap; }
.filter { width: auto; }
</style>
