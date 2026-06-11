import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import App from './App.vue';
import router from './router';
import { setSessionExpiredHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus);

setSessionExpiredHandler(() => {
  const auth = useAuthStore();
  auth.logout();
  router.push('/login');
});

app.mount('#app');
