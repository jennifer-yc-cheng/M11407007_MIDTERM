import { createRouter, createWebHistory } from 'vue-router';
import { auth } from './auth.js';
import Home from './views/Home.vue';
import Login from './views/Login.vue';
import HqDashboard from './views/HqDashboard.vue';
import BranchMenu from './views/BranchMenu.vue';
import BranchAdmin from './views/BranchAdmin.vue';
import KioskView from './views/KioskView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/login', component: Login },
    { path: '/hq', component: HqDashboard, meta: { admin: true } },
    { path: '/:code', component: BranchMenu },
    { path: '/:code/admin', component: BranchAdmin, meta: { staff: true } },
    // 店內自助點餐機：全螢幕版面，不顯示網站上方選單
    { path: '/:code/kiosk', component: KioskView, meta: { kiosk: true } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (!to.meta.admin && !to.meta.staff) return true;
  const user = auth.user;
  if (!user) return { path: '/login', query: { redirect: to.fullPath } };
  if (user.role === 'admin') return true;
  if (to.meta.admin) return `/${user.branchCode}/admin`;
  if (to.meta.staff && to.params.code !== user.branchCode) return `/${user.branchCode}/admin`;
  return true;
});

export default router;
