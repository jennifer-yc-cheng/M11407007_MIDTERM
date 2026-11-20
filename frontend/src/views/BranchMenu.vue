<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { branchApi, money } from '../api.js';
import { auth } from '../auth.js';

const route = useRoute();
const code = route.params.code;
const api = branchApi(code);

const menu = ref(null);
const error = ref('');
const cart = ref([]);
const choices = reactive({}); // 每張飲品卡片目前選的甜度 / 冰塊
const placing = ref(false);
const result = ref(null);
const orderError = ref('');

const total = computed(() => cart.value.reduce((a, i) => a + i.price * i.qty, 0));
const canManage = computed(
  () => auth.user && (auth.user.role === 'admin' || auth.user.branchCode === code)
);

function add(source, d) {
  const c = choices[`${source}-${d.id}`];
  const existing = cart.value.find(
    (i) => i.source === source && i.drinkId === d.id && i.sugar === c.sugar && i.ice === c.ice
  );
  if (existing) existing.qty++;
  else cart.value.push({ source, drinkId: d.id, name: d.name, price: d.price, sugar: c.sugar, ice: c.ice, qty: 1 });
  result.value = null;
}

function changeQty(item, delta) {
  item.qty += delta;
  if (item.qty <= 0) cart.value = cart.value.filter((i) => i !== item);
}

async function placeOrder() {
  placing.value = true;
  orderError.value = '';
  try {
    result.value = await api.post('/orders', {
      items: cart.value.map(({ source, drinkId, qty, sugar, ice }) => ({ source, drinkId, qty, sugar, ice })),
    });
    cart.value = [];
  } catch (e) {
    orderError.value = e.message;
  } finally {
    placing.value = false;
  }
}

onMounted(async () => {
  try {
    const m = await api.get('/menu');
    const init = { sugar: m.sugarOptions[0], ice: m.iceOptions[0] };
    for (const d of m.common) choices[`common-${d.id}`] = { ...init };
    for (const d of m.specials) choices[`special-${d.id}`] = { ...init };
    menu.value = m;
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <div v-if="error" class="alert error">無法載入分店「{{ code }}」：{{ error }}</div>
  <p v-else-if="!menu" class="muted">載入菜單中…</p>

  <template v-else>
    <section class="branch-head">
      <div>
        <span class="badge">{{ menu.branch.city }}</span>
        <h1>{{ menu.branch.name }}</h1>
        <p class="muted">{{ menu.branch.address }}</p>
      </div>
      <RouterLink v-if="canManage" :to="`/${code}/admin`" class="btn ghost">進入分店後台</RouterLink>
    </section>

    <div v-if="!menu.hqOnline" class="alert info">
      目前無法連線總部，經典飲品顯示的是本店快取菜單；訂單會在總部恢復後自動同步。
    </div>

    <div class="layout">
      <div>
        <section v-if="menu.specials.length" class="section">
          <div class="section-title">
            <h2>本店特色飲品</h2>
            <span class="muted">只有 {{ menu.branch.name }} 喝得到</span>
          </div>
          <div class="grid grid-cards">
            <article v-for="d in menu.specials" :key="'s' + d.id" class="card drink special">
              <span class="badge special">特色</span>
              <h3>{{ d.name }}</h3>
              <p class="muted desc">{{ d.description }}</p>
              <div class="opts">
                <select v-model="choices['special-' + d.id].sugar"><option v-for="o in menu.sugarOptions" :key="o">{{ o }}</option></select>
                <select v-model="choices['special-' + d.id].ice"><option v-for="o in menu.iceOptions" :key="o">{{ o }}</option></select>
              </div>
              <div class="foot">
                <strong>{{ money(d.price) }}</strong>
                <button class="btn small" @click="add('special', d)">加入</button>
              </div>
            </article>
          </div>
        </section>

        <section class="section">
          <div class="section-title">
            <h2>經典飲品</h2>
            <span class="muted">全品牌分店相同</span>
          </div>
          <div class="grid grid-cards">
            <article v-for="d in menu.common" :key="'c' + d.id" class="card drink">
              <h3>{{ d.name }}</h3>
              <p class="muted desc">{{ d.description }}</p>
              <div class="opts">
                <select v-model="choices['common-' + d.id].sugar"><option v-for="o in menu.sugarOptions" :key="o">{{ o }}</option></select>
                <select v-model="choices['common-' + d.id].ice"><option v-for="o in menu.iceOptions" :key="o">{{ o }}</option></select>
              </div>
              <div class="foot">
                <strong>{{ money(d.price) }}</strong>
                <button class="btn small" @click="add('common', d)">加入</button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <aside class="card cart">
        <h2>購物車</h2>
        <div v-if="result" class="alert success">
          訂單 #{{ result.orderId }} 已成立，共 {{ money(result.total) }}。謝謝光臨！
        </div>
        <div v-if="orderError" class="alert error">{{ orderError }}</div>
        <p v-if="!cart.length" class="muted">尚未選擇飲品</p>
        <ul v-else class="items">
          <li v-for="(i, idx) in cart" :key="idx">
            <div>
              <div>{{ i.name }}</div>
              <div class="muted small">{{ i.sugar }} · {{ i.ice }} · {{ money(i.price) }}</div>
            </div>
            <div class="qty">
              <button class="btn ghost small" @click="changeQty(i, -1)">−</button>
              <span>{{ i.qty }}</span>
              <button class="btn ghost small" @click="changeQty(i, 1)">＋</button>
            </div>
          </li>
        </ul>
        <div class="total"><span>合計</span><strong>{{ money(total) }}</strong></div>
        <button class="btn checkout" :disabled="!cart.length || placing" @click="placeOrder">
          {{ placing ? '送出中…' : '送出訂單' }}
        </button>
      </aside>
    </div>
  </template>
</template>

<style scoped>
.branch-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.branch-head h1 { margin: 8px 0 4px; }
.branch-head p { margin: 0; }
.layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
.drink { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
.drink h3 { margin: 0; }
.drink.special { border-color: #bcd6c3; }
.drink .badge { align-self: flex-start; }
.desc { margin: 0; flex: 1; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.opts select { padding: 6px; font-size: 0.85rem; }
.foot { display: flex; justify-content: space-between; align-items: center; }
.cart { position: sticky; top: 84px; margin-top: 28px; }
.items { list-style: none; padding: 0; margin: 0 0 12px; }
.items li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.small { font-size: 0.8rem; }
.qty { display: flex; align-items: center; gap: 6px; }
.qty span { min-width: 1.5em; text-align: center; }
.total { display: flex; justify-content: space-between; font-size: 1.1rem; margin: 12px 0; }
.checkout { width: 100%; }
@media (max-width: 860px) {
  .layout { grid-template-columns: 1fr; }
  .cart { position: static; }
}
</style>
