<script setup>
// 飲品圖片；沒有圖片（例如分店特色飲品）或載入失敗時顯示品牌風格的預設圖
import { ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, default: null },
  name: { type: String, required: true },
});
const failed = ref(false);
watch(() => props.src, () => (failed.value = false));
</script>

<template>
  <div class="drink-img">
    <img v-if="src && !failed" :src="src" :alt="name" loading="lazy" @error="failed = true" />
    <div v-else class="placeholder" aria-hidden="true">{{ name.slice(0, 1) }}</div>
  </div>
</template>

<style scoped>
.drink-img { aspect-ratio: 1 / 1; width: 100%; border-radius: 10px; overflow: hidden; background: var(--brand-soft); }
img { width: 100%; height: 100%; object-fit: cover; display: block; }
.placeholder {
  width: 100%; height: 100%; display: grid; place-items: center;
  font-size: 3rem; font-weight: 700; color: var(--brand);
  background: radial-gradient(circle at 30% 25%, #fff 0, var(--brand-soft) 70%);
}
</style>
