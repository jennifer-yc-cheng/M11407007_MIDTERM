import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // 本機開發時（npm run dev），把 /api 轉給已經用 docker compose 跑起來的 gateway
    proxy: { '/api': process.env.API_TARGET || 'http://localhost' },
  },
});
