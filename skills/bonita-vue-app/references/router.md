# Router Template — vue-router 4 in hash mode

## Why `createWebHashHistory`

Bonita's Tomcat doesn't rewrite unknown URLs to `index.html`. With `createWebHistory`, refreshing `/tasks/123` returns 404 because Tomcat looks for a literal `tasks/123` resource. `createWebHashHistory` puts the route after `#` (`/#/tasks/123`), so the URL the server sees is always `index.html`.

## src/router/index.ts

```ts
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('@/pages/HomePage.vue') },
      { path: 'tasks', name: 'tasks', component: () => import('@/pages/TasksPage.vue') },
      { path: 'tasks/:id', name: 'task-detail', component: () => import('@/pages/TaskDetailPage.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (auth.isLoading) return;          // Wait for initial probe

  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  if (to.path === '/login' && auth.isAuthenticated) {
    return '/';
  }
});

export default router;
```

## Programmatic navigation

```ts
import { useRouter } from 'vue-router';

const router = useRouter();
router.push('/tasks');
router.push({ name: 'task-detail', params: { id: '123' } });
router.replace('/login');
router.back();
```

## Reading params

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
const taskId = route.params.id as string;
</script>
```

For reactive param changes:

```ts
import { computed } from 'vue';
const taskId = computed(() => route.params.id as string);
```

## Linking

```vue
<RouterLink to="/tasks">My Tasks</RouterLink>
<RouterLink :to="{ name: 'task-detail', params: { id: task.id } }">View</RouterLink>
```

Inside iframe, this only updates the iframe's hash — exactly what we want.

## Route meta typing

For autocompletion on `to.meta.requiresAuth`:

```ts
// types/router.d.ts
import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
  }
}
```

## Lazy-loaded routes — why and how

Each `() => import('...')` produces a separate JS chunk. Vite splits them automatically. The user only downloads the page they navigate to, keeping the initial bundle small.

For frequently-visited pages (like the home page) you might prefer eager imports — slightly faster first navigation, larger initial bundle. Both work; lazy is the default recommendation.

## Edge case — initial hash

When the user lands on `/bonita/apps/myApp/#/tasks/123`:
1. Tomcat serves `index.html`
2. Vue mounts, `createRouter` reads `window.location.hash` → `#/tasks/123`
3. The router renders the matching route directly

If the parent URL has `#/...` but the iframe URL doesn't (because the iframe loaded after the parent), copy the parent hash into the iframe before mounting:

```ts
// src/main.ts BEFORE createApp
try {
  if (window.parent && window.parent !== window) {
    const parentHash = window.parent.location.hash;
    if (parentHash && !window.location.hash) {
      window.location.hash = parentHash;
    }
  }
} catch {
  // Cross-origin — ignore
}
```

Most simple Bonita apps don't need this — only matters if users bookmark deep links at the parent level.
