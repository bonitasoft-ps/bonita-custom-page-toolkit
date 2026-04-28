# Auth Template — Vue 3 + Pinia

## src/stores/auth.ts

Setup-style Pinia store. Composable, type-safe, exposes refs/computeds directly.

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getSession, logout as apiLogout } from '@/api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isAuthenticated = computed(() => user.value !== null);
  const isLoading = ref(true);          // True until first session probe completes

  async function loadSession() {
    isLoading.value = true;
    try {
      const s = await getSession();
      user.value = {
        userId: s.user_id,
        userName: s.user_name,
        displayName: s.user_name,
        isTechnicalUser: s.is_technical_user,
      };
    } catch {
      user.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  function setUser(u: AuthUser) {
    user.value = u;
  }

  async function logout() {
    try {
      await apiLogout();
    } finally {
      user.value = null;
    }
  }

  return { user, isAuthenticated, isLoading, loadSession, setUser, logout };
});
```

## src/pages/LoginPage.vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElForm, ElFormItem, ElInput, ElButton, ElMessage } from 'element-plus';
import { login, getSession } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const loading = ref(false);

async function onSubmit() {
  if (!username.value || !password.value) return;
  loading.value = true;
  try {
    await login(username.value, password.value);
    const s = await getSession();
    auth.setUser({
      userId: s.user_id,
      userName: s.user_name,
      displayName: s.user_name,
      isTechnicalUser: s.is_technical_user,
    });
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch {
    ElMessage.error('Invalid credentials');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <ElForm @submit.prevent="onSubmit" class="login-form">
      <h1>Sign in</h1>
      <ElFormItem>
        <ElInput v-model="username" placeholder="Username" autocomplete="username" />
      </ElFormItem>
      <ElFormItem>
        <ElInput
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />
      </ElFormItem>
      <ElButton type="primary" native-type="submit" :loading="loading" block>
        Sign in
      </ElButton>
    </ElForm>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh;
  background: var(--color-bg, #f3f3f1);
}
.login-form {
  width: 320px;
  padding: 32px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}
</style>
```

## Route guard (in src/router/index.ts)

```ts
router.beforeEach((to) => {
  const auth = useAuthStore();

  // Wait for the initial session probe to finish before deciding
  if (auth.isLoading) return;

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  if (to.path === '/login' && auth.isAuthenticated) {
    return '/';
  }
});
```

Tag protected routes:

```ts
{ path: '/tasks', component: TasksPage, meta: { requiresAuth: true } }
```

## Session-expired handling

Wire the API client's session-expired callback to the store on app boot:

```ts
// src/main.ts (or App.vue)
import { setSessionExpiredHandler } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

setSessionExpiredHandler(() => {
  const auth = useAuthStore();
  auth.logout();
  router.push('/login');
});
```

This must happen AFTER `app.use(createPinia())` so the store is initialized.

## Why `isLoading` instead of just `isAuthenticated`

The session probe is async. Without `isLoading`:
- App mounts → router immediately sees `isAuthenticated = false` → redirects to `/login`
- Probe finishes → `isAuthenticated = true` → user is back at `/login` confused

With `isLoading`:
- Router guard waits for `isLoading = false` before deciding
- The user lands on the right page on first paint

## Why setup-style Pinia (not options style)

Setup style:
- Direct access to refs/computeds — no `state.foo`/`getters.foo` indirection
- Better TypeScript inference
- Same mental model as `<script setup>` components

Options style (Pinia's older API) still works but is less idiomatic in Vue 3.
