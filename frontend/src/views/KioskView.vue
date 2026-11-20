<script setup>
// 店內自助點餐機（Kiosk）：全螢幕、大按鈕、觸控操作；閒置一段時間自動回到歡迎畫面
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { branchApi, money } from '../api.js';
import DrinkImage from '../components/DrinkImage.vue';

const IDLE_SECONDS = 60; // 點餐中閒置多久後自動清空
const DONE_SECONDS = 12; // 完成畫面停留秒數

const route = useRoute();
const code = route.params.code;
const api = branchApi(code);

const stage = ref('welcome'); // welcome | menu | done
const menu = ref(null);
const loadError = ref('');
const cart = ref([]);
const picking = ref(null); // 正在選甜度／冰塊的飲品
const pick = reactive({ sugar: '', ice: '', qty: 1 });
const cartOpen = ref(false);
const placing = ref(false);
const orderError = ref('');
const result = ref(null);
const countdown = ref(0);

const count = computed(() => cart.value.reduce((a, i) => a + i.qty, 0));
const total = computed(() => cart.value.reduce((a, i) => a + i.price * i.qty, 0));

async function loadMenu() {
  try {
    menu.value = await api.get('/menu');
    loadError.value = '';
  } catch (e) {
    loadError.value = e.message;
  }
}

function reset() {
  cart.value = [];
  picking.value = null;
  cartOpen.value = false;
  orderError.value = '';
  result.value = null;
  stage.value = 'welcome';
  loadMenu(); // 回到歡迎畫面時重新載入，價格或特色飲品有更新會立即反映
}

function start() {
  if (!menu.value) return;
  stage.value = 'menu';
  touch();
}

function openPick(source, d) {
  picking.value = { source, ...d };
  Object.assign(pick, { sugar: menu.value.sugarOptions[0], ice: menu.value.iceOptions[0], qty: 1 });
}

function addPicked() {
  const d = picking.value;
  const existing = cart.value.find(
    (i) => i.source === d.source && i.drinkId === d.id && i.sugar === pick.sugar && i.ice === pick.ice
  );
  if (existing) existing.qty = Math.min(50, existing.qty + pick.qty);
  else cart.value.push({ source: d.source, drinkId: d.id, name: d.name, image: d.image, price: d.price, sugar: pick.sugar, ice: pick.ice, qty: pick.qty });
  picking.value = null;
}

function changeQty(item, delta) {
  item.qty = Math.min(50, item.qty + delta);
  if (item.qty <= 0) cart.value = cart.value.filter((i) => i !== item);
  if (!cart.value.length) cartOpen.value = false;
}

async function checkout() {
  placing.value = true;
  orderError.value = '';
  try {
    result.value = await api.post('/orders', {
      channel: 'kiosk',
      items: cart.value.map(({ source, drinkId, qty, sugar, ice }) => ({ source, drinkId, qty, sugar, ice })),
    });
    cart.value = [];
    cartOpen.value = false;
    stage.value = 'done';
    countdown.value = DONE_SECONDS;
  } catch (e) {
    orderError.value = e.message;
  } finally {
    placing.value = false;
  }
}

// ---- 閒置偵測與完成畫面倒數 ----
let lastTouch = Date.now();
const touch = () => (lastTouch = Date.now());
const timer = setInterval(() => {
  if (stage.value === 'menu' && Date.now() - lastTouch > IDLE_SECONDS * 1000) reset();
  if (stage.value === 'done' && --countdown.value <= 0) reset();
}, 1000);

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

onMounted(() => {
  loadMenu();
  window.addEventListener('pointerdown', touch);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener('pointerdown', touch);
});
</script>

<template>
  <div class="kiosk">
    <!-- 歡迎畫面 -->
    <button v-if="stage === 'welcome'" class="welcome" @click="start">
      <span class="logo-mark">茶</span>
      <span class="brand">開心茶飲 Happy Tea</span>
      <span v-if="menu" class="branch">{{ menu.branch.name }}</span>
      <span v-if="loadError" class="err">暫時無法點餐：{{ loadError }}</span>
      <span v-else-if="!menu" class="hint">載入中…</span>
      <span v-else class="cta">點一下開始點餐</span>
    </button>
    <button v-if="stage === 'welcome'" class="fs-btn" @click="toggleFullscreen">全螢幕</button>

    <!-- 點餐畫面 -->
    <template v-if="stage === 'menu' && menu">
      <header class="k-head">
        <div>
          <div class="k-title">{{ menu.branch.name }}</div>
          <div class="k-sub">自助點餐</div>
        </div>
        <button class="k-btn ghost" @click="reset">重新開始</button>
      </header>

      <main class="k-body">
        <section v-if="menu.specials.length">
          <h2>本店特色 <span class="tag">只有這裡喝得到</span></h2>
          <div class="k-grid">
            <button v-for="d in menu.specials" :key="'s' + d.id" class="k-card" @click="openPick('special', d)">
              <DrinkImage :src="d.image" :name="d.name" />
              <span class="k-name">{{ d.name }}</span>
              <span class="k-price">{{ money(d.price) }}</span>
            </button>
          </div>
        </section>
        <section>
          <h2>經典飲品</h2>
          <div class="k-grid">
            <button v-for="d in menu.common" :key="'c' + d.id" class="k-card" @click="openPick('common', d)">
              <DrinkImage :src="d.image" :name="d.name" />
              <span class="k-name">{{ d.name }}</span>
              <span class="k-price">{{ money(d.price) }}</span>
            </button>
          </div>
        </section>
      </main>

      <footer class="k-cartbar">
        <div>
          <div class="k-count">已選 {{ count }} 杯</div>
          <div class="k-total">{{ money(total) }}</div>
        </div>
        <button class="k-btn big" :disabled="!cart.length" @click="cartOpen = true">查看購物車並結帳</button>
      </footer>

      <!-- 選擇甜度冰塊 -->
      <div v-if="picking" class="overlay" @click.self="picking = null">
        <div class="sheet">
          <div class="pick-head">
            <div class="pick-img"><DrinkImage :src="picking.image" :name="picking.name" /></div>
            <div>
              <div class="k-title">{{ picking.name }}</div>
              <p class="desc">{{ picking.description }}</p>
              <div class="k-price">{{ money(picking.price) }}</div>
            </div>
          </div>
          <h3>甜度</h3>
          <div class="chips">
            <button v-for="o in menu.sugarOptions" :key="o" class="chip" :class="{ on: pick.sugar === o }" @click="pick.sugar = o">{{ o }}</button>
          </div>
          <h3>冰塊</h3>
          <div class="chips">
            <button v-for="o in menu.iceOptions" :key="o" class="chip" :class="{ on: pick.ice === o }" @click="pick.ice = o">{{ o }}</button>
          </div>
          <h3>數量</h3>
          <div class="stepper">
            <button class="k-btn ghost round" :disabled="pick.qty <= 1" @click="pick.qty--">−</button>
            <span>{{ pick.qty }}</span>
            <button class="k-btn ghost round" :disabled="pick.qty >= 20" @click="pick.qty++">＋</button>
          </div>
          <div class="sheet-actions">
            <button class="k-btn ghost" @click="picking = null">取消</button>
            <button class="k-btn big" @click="addPicked">加入購物車 · {{ money(picking.price * pick.qty) }}</button>
          </div>
        </div>
      </div>

      <!-- 購物車 -->
      <div v-if="cartOpen" class="overlay" @click.self="cartOpen = false">
        <div class="sheet">
          <div class="k-title">確認您的訂單</div>
          <div v-if="orderError" class="alert error">{{ orderError }}</div>
          <ul class="k-items">
            <li v-for="(i, idx) in cart" :key="idx">
              <div class="li-img"><DrinkImage :src="i.image" :name="i.name" /></div>
              <div class="li-info">
                <div class="k-name">{{ i.name }}</div>
                <div class="desc">{{ i.sugar }} · {{ i.ice }} · {{ money(i.price) }}</div>
              </div>
              <div class="stepper small">
                <button class="k-btn ghost round" @click="changeQty(i, -1)">−</button>
                <span>{{ i.qty }}</span>
                <button class="k-btn ghost round" @click="changeQty(i, 1)">＋</button>
              </div>
            </li>
          </ul>
          <div class="sum"><span>合計</span><strong>{{ money(total) }}</strong></div>
          <div class="sheet-actions">
            <button class="k-btn ghost" @click="cartOpen = false">繼續點餐</button>
            <button class="k-btn big" :disabled="placing || !cart.length" @click="checkout">
              {{ placing ? '送出中…' : '確認送出' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 完成畫面 -->
    <button v-if="stage === 'done' && result" class="welcome done" @click="reset">
      <span class="cta">點餐完成！</span>
      <span class="k-sub light">您的取餐號碼</span>
      <span class="number">{{ String(result.orderId).padStart(3, '0') }}</span>
      <span class="branch">金額 {{ money(result.total) }} · 請至櫃台付款取餐</span>
      <span class="hint">{{ countdown }} 秒後回到首頁（點一下立即返回）</span>
    </button>
  </div>
</template>

<style scoped>
.kiosk { min-height: 100vh; min-height: 100dvh; background: var(--bg); display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
button { font-family: inherit; touch-action: manipulation; }

/* 歡迎與完成畫面 */
.welcome {
  flex: 1; border: 0; cursor: pointer; color: #fff; text-align: center;
  background: linear-gradient(160deg, var(--brand) 0%, var(--brand-dark) 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px 16px;
}
.welcome .logo-mark { width: 96px; height: 96px; border-radius: 28px; background: #fff; color: var(--brand); display: grid; place-items: center; font-size: 3rem; font-weight: 700; }
.welcome .brand { font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 700; }
.welcome .branch { font-size: clamp(1.1rem, 3vw, 1.6rem); opacity: 0.9; }
.welcome .cta { margin-top: 24px; font-size: clamp(1.4rem, 4vw, 2.2rem); font-weight: 700; padding: 16px 40px; border: 3px solid #fff; border-radius: 999px; animation: pulse 2s ease-in-out infinite; }
.welcome .hint { opacity: 0.8; }
.welcome .err { background: rgba(0, 0, 0, 0.25); padding: 10px 16px; border-radius: 8px; }
.welcome.done { background: linear-gradient(160deg, var(--accent) 0%, #2c5c39 100%); }
.welcome.done .cta { animation: none; border: 0; margin: 0; }
.number { font-size: clamp(5rem, 18vw, 10rem); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.light { color: #fff; opacity: 0.85; }
@keyframes pulse { 50% { transform: scale(1.05); } }
.fs-btn { position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); background: rgba(255, 255, 255, 0.2); color: #fff; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 8px; padding: 8px 14px; cursor: pointer; }

/* 點餐畫面 */
.k-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
.k-title { font-size: 1.5rem; font-weight: 700; }
.k-sub { color: var(--muted); }
.k-body { flex: 1; padding: 8px 24px 140px; }
.k-body h2 { font-size: 1.4rem; margin: 24px 0 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tag { font-size: 0.85rem; font-weight: 500; background: #e4efe7; color: var(--accent); padding: 4px 12px; border-radius: 999px; }
.k-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
.k-card {
  display: flex; flex-direction: column; gap: 8px; padding: 12px; text-align: left; cursor: pointer;
  background: var(--surface); border: 2px solid var(--line); border-radius: 16px; transition: transform 0.08s, border-color 0.08s;
}
.k-card:active { transform: scale(0.97); border-color: var(--brand); }
.k-name { font-size: 1.2rem; font-weight: 700; color: var(--ink); }
.k-price { font-size: 1.15rem; color: var(--brand); font-weight: 700; }

.k-btn { border: 2px solid var(--brand); background: var(--brand); color: #fff; border-radius: 14px; padding: 12px 20px; font-size: 1.1rem; font-weight: 600; cursor: pointer; min-height: 56px; }
.k-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.k-btn.ghost { background: var(--surface); color: var(--brand); }
.k-btn.big { font-size: 1.25rem; padding: 14px 28px; }
.k-btn.round { width: 56px; padding: 0; font-size: 1.6rem; }

.k-cartbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 6;
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));
  background: var(--surface); border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(60, 40, 20, 0.08);
}
.k-count { color: var(--ink-2); }
.k-total { font-size: 1.6rem; font-weight: 800; font-variant-numeric: tabular-nums; }

/* 彈出視窗 */
.overlay { position: fixed; inset: 0; z-index: 20; background: rgba(30, 20, 10, 0.5); display: flex; align-items: flex-end; justify-content: center; }
.sheet {
  background: var(--surface); width: 100%; max-width: 720px; max-height: 92vh; overflow-y: auto;
  border-radius: 24px 24px 0 0; padding: 24px 24px calc(24px + env(safe-area-inset-bottom, 0px));
}
.sheet h3 { margin: 20px 0 10px; font-size: 1.1rem; }
.pick-head { display: flex; gap: 20px; align-items: center; }
.pick-img { width: 140px; flex-shrink: 0; }
.desc { color: var(--ink-2); margin: 6px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }
.chip { min-height: 52px; min-width: 88px; padding: 0 18px; font-size: 1.05rem; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
.chip.on { border-color: var(--brand); background: var(--brand-soft); color: var(--brand-dark); font-weight: 700; }
.stepper { display: flex; align-items: center; gap: 16px; }
.stepper span { font-size: 1.6rem; font-weight: 700; min-width: 2ch; text-align: center; }
.stepper.small { gap: 8px; }
.stepper.small span { font-size: 1.2rem; }
.sheet-actions { display: flex; gap: 12px; margin-top: 24px; }
.sheet-actions .big { flex: 1; }

.k-items { list-style: none; padding: 0; margin: 16px 0; }
.k-items li { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.li-img { width: 64px; flex-shrink: 0; }
.li-info { flex: 1; min-width: 0; }
.sum { display: flex; justify-content: space-between; font-size: 1.4rem; margin-top: 8px; }

@media (max-width: 600px) {
  .k-head, .k-body, .k-cartbar { padding-left: 16px; padding-right: 16px; }
  .k-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .pick-img { width: 96px; }
  .k-cartbar .k-btn.big { font-size: 1rem; padding: 12px 16px; }
}
</style>
