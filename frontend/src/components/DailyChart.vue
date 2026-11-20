<script setup>
// 近 N 日營收直條圖：daily = [{ day: 'YYYY-MM-DD', revenue, orders }]
import { computed } from 'vue';
import { money } from '../api.js';

const props = defineProps({ daily: { type: Array, required: true } });
const max = computed(() => Math.max(1, ...props.daily.map((d) => d.revenue)));
const short = (day) => day.slice(5).replace('-', '/');
</script>

<template>
  <div>
    <div class="columns" role="img" aria-label="每日營收長條圖">
      <div v-for="d in daily" :key="d.day" class="col">
        <span class="tip">{{ short(d.day) }}：{{ money(d.revenue) }}（{{ d.orders }} 筆）</span>
        <div class="fill" :style="{ height: (d.revenue / max) * 100 + '%' }"></div>
      </div>
    </div>
    <div class="col-labels">
      <span v-for="d in daily" :key="d.day">{{ short(d.day) }}</span>
    </div>
    <details class="table-view">
      <summary class="muted">表格檢視</summary>
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th class="num">訂單數</th><th class="num">營收</th></tr></thead>
          <tbody>
            <tr v-for="d in daily" :key="d.day">
              <td>{{ d.day }}</td><td class="num">{{ d.orders }}</td><td class="num">{{ money(d.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<style scoped>
.table-view { margin-top: 12px; }
.table-view summary { cursor: pointer; }
</style>
