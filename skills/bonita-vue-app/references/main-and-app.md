# `main.ts` and `App.vue` — wiring

## src/main.ts

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { setSessionExpiredHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import '@/styles/global.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus);

// Wire session-expired handler AFTER pinia.install (auth store is then available)
setSessionExpiredHandler(() => {
  const auth = useAuthStore();
  auth.logout();
  router.push('/login');
});

app.mount('#app');
```

## src/App.vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

// One-time session probe on mount.
// Inside the Bonita Portal iframe, the user is already logged in,
// so this populates the user object without showing the login form.
onMounted(() => auth.loadSession());
</script>

<template>
  <RouterView />
</template>
```

## Order matters

```
1. createApp(App)             — App is created but not yet mounted
2. app.use(createPinia())     — Pinia plugin installed; stores can now be used
3. app.use(router)            — Router installed; beforeEach hooks registered
4. app.use(ElementPlus)       — Component library
5. setSessionExpiredHandler() — Now safe to call useAuthStore()
6. app.mount('#app')          — DOM render starts; App.vue's onMounted fires
```

If you call `useAuthStore()` BEFORE `app.use(createPinia())`, you get the warning:

> [🍍]: getActivePinia() was called but there was no active Pinia.

## Optional — i18n

```ts
import { createI18n } from 'vue-i18n';
import en from '@/i18n/en';
import es from '@/i18n/es';

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'en',
  fallbackLocale: 'en',
  messages: { en, es },
});

app.use(i18n);
```

In components:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
</script>

<template>
  <h1>{{ t('home.welcome') }}</h1>
</template>
```

## Optional — global error boundary

Vue 3's `app.config.errorHandler`:

```ts
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err, info);
  // Send to your monitoring system
};
```

For unhandled promise rejections:

```ts
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});
```

## index.html — minimal entry

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <title>My Bonita App</title>
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob:; connect-src 'self';
      frame-src 'self' blob:; frame-ancestors 'none';
      base-uri 'self'; form-action 'self'" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

No `<base href>` — Vite's `base: './'` produces relative paths in the built output already.
