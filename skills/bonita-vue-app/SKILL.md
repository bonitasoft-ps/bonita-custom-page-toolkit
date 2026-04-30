---
name: bonita-vue-app
description: Use when the user wants to create a new Vue 3 application for Bonita, scaffold a Vue custom page, or set up a Vite + Vue 3 + TypeScript project served by Bonita's Tomcat. Covers Vue-specific scaffolding, vite.config.ts, vue-router with createWebHashHistory, Pinia stores, vue-i18n, Element Plus / Naive UI wiring. Delegates the framework-agnostic parts (architecture, ZIP layout, page.properties, Bonita APIs, CSRF, deployment) to the bonita-custom-page skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|explain> [app-name]"
---

# Bonita Vue App — custom page skill

You are an expert in building Vue 3 + Vite + TypeScript applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/` (architecture, Bonita APIs, auth/CSRF, page.properties, ZIP packaging, deployment). Don't restate them here — link to them.

This skill covers only what is **Vue-specific**.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite | Fast HMR, native ESM, configurable proxy |
| UI | Vue 3 + TypeScript + `<script setup>` | Composition API, fully typed |
| Components | Element Plus (or Naive UI / PrimeVue) | Mature, themeable, suits enterprise UIs |
| Router | vue-router 4 + `createWebHashHistory` | Hash routing required for iframe deployment |
| State | Pinia (setup-store style) | Composition-friendly, type-safe, official Vue store |
| i18n | vue-i18n 10 (composition mode) | Required for multi-locale enterprise apps |
| HTTP | `fetch` | Native — no extra dependency for the API client |

## Activation flow

When this skill activates:

1. **Determine the action**: scaffold a new app, wrap an existing one, or explain a pattern?
2. **Ask the questions in §"Questions to ask before generating"** — don't assume.
3. **Read the foundational skill**: `../bonita-custom-page/SKILL.md`.
4. **Apply Vue idioms**: use the templates in `references/` for code samples.

## Questions to ask before generating

(See `../bonita-custom-page/SKILL.md` §"Questions to ask BEFORE doing anything" for the universal checklist.)

Vue-specific add-ons:

| # | Question | Notes |
|---|----------|-------|
| V1 | Component library: **Element Plus**, **Naive UI**, **PrimeVue**, **Vuetify**, or **none**? | Element Plus is a safe default. PrimeVue if the user wants polished defaults. None if bundle size is critical. |
| V2 | i18n needed? **vue-i18n** or skip? | vue-i18n adds ~30 KB gzip. Skip unless multi-locale is a real requirement. |
| V3 | Composition API only or also Options API? | Default Composition API + `<script setup>`. Don't mix unless bridging a Vue 2 codebase. |

## Scaffolding a new project

### Step 1 — initialize

```bash
npm create vite@latest {app-name} -- --template vue-ts
cd {app-name}
npm install vue-router@4 pinia vue-i18n@10
npm install element-plus @element-plus/icons-vue       # or naive-ui / primevue
npm install -D archiver
```

### Step 2 — project structure

```
src/
├── api/
│   ├── client.ts          ← fetch wrapper with CSRF
│   └── auth.ts            ← login / getSession / logout
├── router/
│   └── index.ts           ← createRouter + createWebHashHistory
├── stores/
│   ├── auth.ts            ← Pinia auth store (setup style)
│   └── theme.ts           ← Optional: dynamic theme tokens
├── composables/
│   └── useViewportFill.ts ← Iframe-aware viewport sizing
├── components/
│   ├── AppLayout.vue
│   ├── Sidebar.vue
│   └── Topbar.vue
├── pages/
│   ├── HomePage.vue
│   ├── LoginPage.vue
│   └── TasksPage.vue
├── i18n/
│   ├── index.ts
│   ├── en.ts
│   └── es.ts
├── styles/
│   ├── tokens.css
│   └── global.css
├── App.vue                ← <RouterView/> + onMounted session probe
└── main.ts                ← createApp + plugins + mount
```

### Step 3 — apply the templates

- [`references/vite-config.md`](references/vite-config.md) — Vite config with proxy + relative base + `@/` alias
- [`references/api-client.md`](references/api-client.md) — Centralized fetch wrapper with CSRF
- [`references/auth.md`](references/auth.md) — Auth API + Pinia store + route guard
- [`references/router.md`](references/router.md) — `createWebHashHistory` setup with auth guard
- [`references/main-and-app.md`](references/main-and-app.md) — `main.ts` plugin wiring + `App.vue` boot logic

For ZIP packaging and `page.properties`, use the universal templates from `../bonita-custom-page/references/zip-packaging.md` and `../bonita-custom-page/references/page-properties.md`.

### Step 4 — package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "build:bonita": "vue-tsc --noEmit && vite build && node scripts/package-bonita.js"
  }
}
```

### Step 5 — `.env`

```env
VITE_BONITA_URL=/bonita
```

## Vue-specific rules (in addition to the universal seven)

### A. `createWebHashHistory()`, never `createWebHistory()`

```ts
import { createRouter, createWebHashHistory } from 'vue-router';

export default createRouter({
  history: createWebHashHistory(),
  routes: [...],
});
```

`createWebHistory()` uses HTML5 pushState which Bonita's Tomcat can't serve.

### B. Pinia setup-store style (composition API)

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => user.value !== null);

  async function loadSession() { /* ... */ }
  function logout() { user.value = null; }

  return { user, isAuthenticated, loadSession, logout };
});
```

Setup style (returning refs/computeds) integrates better with `<script setup>` and gives you full type inference.

### C. Auth guard via `router.beforeEach`

```ts
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});
```

Tag protected routes with `meta: { requiresAuth: true }`.

### D. App-level session probe in `App.vue`

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
onMounted(() => auth.loadSession());
</script>

<template>
  <RouterView />
</template>
```

The probe runs once on mount. Until it resolves, `auth.isAuthenticated` is false; the router guard sends the user to `/login`. After it resolves, if the user has a Bonita session, they're auto-redirected back.

### E. CSP and Element Plus

Element Plus injects styles dynamically — your CSP must allow `'unsafe-inline'` for `style-src`. Same applies to Naive UI and most component libraries. See the universal CSP example in `../bonita-custom-page/SKILL.md`.

### F. Watchers that depend on auth state need `{ immediate: true }`

A subtle gotcha: when a page component uses `watch()` to react to a value coming from the auth store (typical: load tasks when `userId` becomes known), the watcher does NOT fire on mount by default. If the auth store ALREADY has a value at the time the page mounts (because the App-level probe finished before this page rendered), the watcher's getter is evaluated once to track the dependency but the callback never runs — there's no "change" to react to. The result: page loads empty until something else triggers the watcher.

```ts
// ❌ Doesn't fire on mount when auth.user.userId is already set
watch(() => auth.user?.userId, () => load());

// ✅ Fires on mount with the current value, plus on every change
watch(
  () => auth.user?.userId,
  (id) => { if (id) load(); },
  { immediate: true }
);
```

The `if (id)` guard inside the callback handles the case where the watcher fires with an undefined id (auth not loaded yet) — load() is a no-op.

Don't combine `onMounted(load)` AND a non-immediate watcher: in the happy path it'll call `load()` twice. Prefer the immediate watcher alone — it covers both initial state and subsequent changes.

## Common patterns

### Adding a new API module

```ts
// src/api/tasks.ts
import { apiRequest } from './client';

export interface Task {
  id: string;
  name: string;
  caseId: string;
  state: string;
}

export async function getMyTasks(userId: string, page = 0, size = 20): Promise<Task[]> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('f', 'state=ready');
  params.append('f', `user_id=${userId}`);
  // Bonita 2025.x: one `o` per ordering criterion, NOT comma-separated (returns 500)
  params.append('o', 'priority DESC');
  params.append('o', 'dueDate ASC');
  return apiRequest<Task[]>(`/bpm/humanTask?${params}`);
}
```

### Theme tokens loaded from BDM

See the optional `theme` store in the original Vue guide — derive CSS custom properties from a primary/secondary color stored in BDM, apply them to `document.documentElement.style`. This is enterprise-only — skip it for simple apps.

### Iframe-aware viewport sizing

Inside the Bonita Portal iframe, `100vh` doesn't equal the iframe's actual height. Use `100dvh` and the `useViewportFill` composable to size kanban-style boards correctly.

## Troubleshooting (Vue-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Pinia store outside setup` warning | Calling `useStore()` in module top level | Move into `setup` or `onMounted` |
| `<RouterView/>` not rendering | Forgot `app.use(router)` in main.ts | Wire the plugin |
| Element Plus components unstyled | Missing `import 'element-plus/dist/index.css'` | Import in main.ts |
| `vue-tsc` errors on `.vue` imports | Missing `vue-tsc`/`shims` config | Use `vue-tsc --noEmit` for typecheck; Vite handles compilation |
| Hash mode resets to `/` on reload | Used `createWebHistory` instead of `createWebHashHistory` | Switch — see rule A |
| `useI18n() returned undefined` | i18n plugin not installed | `app.use(i18n)` in main.ts |

For framework-agnostic issues (CORS, 401 on every request, blank page in prod, etc.) see `../bonita-custom-page/references/deployment.md`.

## Reference examples

- [`../../examples/vue-task-viewer/`](../../examples/vue-task-viewer/) — task list + login flow, generic 8080 default
- [`../../examples/vue-directory-bonita/`](../../examples/vue-directory-bonita/) — turnkey deploy to a custom Application (`appDirectoryBonitaVue`); ships `build.sh` / `build.bat` (one command for install + ZIP + multilingual EN/FR/ES deploy docs)

## Deployment quick reference (Bonita 2025.x)

After `npm run build:bonita` or `./build.sh`, upload via the Bonita 2025.x admin UI:

1. **`/bonita/apps/superAdminAppBonita/resource-list/`** → +Add → upload the ZIP
2. **`/bonita/apps/superAdminAppBonita/application-list/`** → +Create application; pick **`Layout Without Menu`** so the SPA fills the viewport
3. **`/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}`** → Pages → +Add → token `home` (or whatever)
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough including the Admin EE alternative path: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
