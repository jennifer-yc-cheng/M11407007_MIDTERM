<script setup>
// 單一數列水平長條圖：rows = [{ label, value, display }]
import { computed } from 'vue';

const props = defineProps({
  rows: { type: Array, required: true },
  empty: { type: String, default: '尚無資料' },
});
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value)));
</script>

<template>
  <div v-if="rows.length" class="bars">
    <div v-for="r in rows" :key="r.label" class="bar-row" :title="`${r.label}：${r.display ?? r.value}`">
      <span class="name">{{ r.label }}</span>
      <div class="track"><div class="fill" :style="{ width: (r.value / max) * 100 + '%' }"></div></div>
      <span class="val">{{ r.display ?? r.value }}</span>
    </div>
  </div>
  <p v-else class="muted">{{ empty }}</p>
</template>
