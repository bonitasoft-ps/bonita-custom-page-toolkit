---
name: bonita-svelte-app
description: Use when the user wants to create a new Svelte 5 application for Bonita, scaffold a Svelte custom page, or set up a Vite + Svelte 5 project served by Bonita's Tomcat. Covers Svelte-specific scaffolding (runes, .svelte.ts stores, svelte-spa-router for hash routing), and the deployment flow. Delegates the framework-agnostic parts (architecture, ZIP layout, page.properties, Bonita APIs, CSRF, deployment) to the bonita-custom-page skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|wrap|explain> [app-name]"
---

# Bonita Svelte App — custom page skill

You are an expert in building Svelte 5 (runes-based) + Vite + TypeScript applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/`. Don't restate them here — link to them.

This skill covers only what is **Svelte-specific**.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite | Fast HMR, hashed assets, straight-forward proxy |
| UI | Svelte 5 with **runes** (`$state`, `$derived`, `$effect`) | Modern reactive syntax — the runes API replaces the old `let x = …` reactive declarations |
| Components | None by default — plain CSS | Svelte's bundle is so small (~20 KB gzip) that adding a heavy UI library defeats the purpose. Use Skeleton / Svelte UI / shadcn-svelte only when needed. |
| Router | `svelte-spa-router` | Pure hash routing — required for iframe deployment. Lightweight (~5 KB) |
| State | Class-based stores in `.svelte.ts` files | Use a class with `$state` field; instantiate once and export. Cleaner than the legacy writable/readable stores |
| HTTP | `fetch` | Native — no extra dep |

## Activation flow

When this skill activates:

1. **Determine the action**: scaffold a new app, wrap an existing one, or explain a pattern?
2. **Ask the questions in §"Questions to ask before generating"** — don't assume names, app tokens, etc.
3. **Read the foundational skill** `../bonita-custom-page/SKILL.md`.
4. **Apply Svelte 5 idioms**: runes for reactivity, `.svelte.ts` for stateful modules, hash routing.

## Questions to ask before generating

Before running `bonita-page scaffold` or writing files, gather:

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | What is the **page name** in camelCase? (e.g. `invoiceDashboard`) | Becomes `custompage_<name>` and the ZIP filename. Must match `[a-zA-Z][a-zA-Z0-9]*` |
| 2 | What is the **display name** shown in Bonita admin? | Free text label. Defaults to the page name if not provided |
| 3 | What is the **Application token** in Bonita? (e.g. `myApp`) | URL becomes `/bonita/apps/{appToken}/{pageToken}/` |
| 4 | What is the **page token** within the app? | Default: `home`. Confirm with user if unsure |
| 5 | Is this a **brand-new project** or are you wrapping an **existing Svelte app**? | Determines `scaffold` vs `wrap` |
| 6 | Where should the project live? (target directory) | Default: `./{name}` from cwd |
| 7 | Bonita version: **2025.x** (current) or **7.x** (legacy)? | Affects deployment URLs — see DEPLOY_2025.md |
| 8 | Do you need a **component library** (Skeleton, Svelte UI)? | Default no — keeps bundle <30 KB |

**Don't proceed without 1, 3, and 5**. The rest can take defaults.

## Scaffolding a new project

### Step 1 — initialize

```bash
npm create vite@latest {app-name} -- --template svelte-ts
cd {app-name}
npm install svelte-spa-router
npm install -D archiver @types/node
```

### Step 2 — project structure

```
src/
├── lib/
│   ├── api/
│   │   ├── client.ts          ← fetch wrapper with CSRF
│   │   ├── auth.ts            ← login / getSession / logout
│   │   └── tasks.ts           ← Domain API calls
│   ├── stores/
│   │   └── auth.svelte.ts     ← Class-based runes store (.svelte.ts!)
│   └── pages/
│       ├── Layout.svelte
│       ├── LoginPage.svelte
│       └── TasksPage.svelte
├── App.svelte                 ← Router root + booting state
├── main.ts                    ← mount(App, { target })
├── app.css                    ← Global styles + tokens
└── vite-env.d.ts
```

### Step 3 — apply the templates

- [`references/runes-stores.md`](references/runes-stores.md) — Class store in `.svelte.ts`, the modern Svelte 5 pattern
- [`references/api-client.md`](references/api-client.md) — Centralized fetch wrapper (delegated to `../bonita-custom-page/references/auth-csrf.md` for the universal contract)
- [`references/router.md`](references/router.md) — `svelte-spa-router` setup (hash mode)
- [`references/main-and-app.md`](references/main-and-app.md) — `mount()` API + boot in `App.svelte`

For ZIP packaging and `page.properties`, use the universal templates from `../bonita-custom-page/references/`.

### Step 4 — package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:bonita": "vite build && node scripts/package-bonita.js",
    "dist": "npm run build:bonita && node scripts/copy-docs.js"
  }
}
```

## Svelte-specific rules (in addition to the universal seven)

### A. The file extension matters: `.svelte.ts` for stateful modules

Svelte 5 only enables runes (`$state`, `$derived`, `$effect`) inside files with the `.svelte` or `.svelte.ts` extension. A plain `.ts` file CAN'T use runes.

```ts
// auth.svelte.ts — runes work
class AuthStore {
  user = $state<User | null>(null);
}

// auth.ts — runes throw a build error
class AuthStore {
  user = $state<User | null>(null);  // ❌ ReferenceError: $state is not defined
}
```

If you see "$state is not defined", check the file extension first.

### B. Class-based stores beat writable/readable

The legacy pattern:
```ts
import { writable } from 'svelte/store';
export const user = writable<User | null>(null);
// In component: $user (with the leading $)
```

The modern Svelte 5 pattern:
```ts
class AuthStore {
  user = $state<User | null>(null);
  isAuthenticated = $derived(this.user !== null);
}
export const authStore = new AuthStore();
// In component: authStore.user (no $ prefix needed)
```

The class-based form composes better, has natural TypeScript inference, and avoids the `$store` syntax which gets confusing inside `<script setup>`-style code.

### C. Use `mount()`, not `new App({ target })`

Svelte 5 introduced `mount` and deprecated the constructor pattern:

```ts
// main.ts
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

The legacy `new App(...)` still works but emits a deprecation warning.

### D. `svelte-spa-router` for hash routing

```ts
// App.svelte
<script lang="ts">
  import Router from 'svelte-spa-router';
  import LoginPage from './lib/pages/LoginPage.svelte';
  import Layout from './lib/pages/Layout.svelte';

  const routes = {
    '/login': LoginPage,
    '*': Layout,
  };
</script>

<Router {routes} />
```

Routing inside the Bonita iframe works because every route is a hash (`#/login`, `#/foo`). On hard refresh, the URL the server sees is always `index.html`, then svelte-spa-router reads the hash and renders the right route.

### E. `$effect` for side effects, NOT `onMount`

In Svelte 5, prefer `$effect` over `onMount` when reacting to state:

```svelte
<script>
  import { authStore } from './stores/auth.svelte';
  import { push } from 'svelte-spa-router';

  // Re-evaluates whenever isAuthenticated changes
  $effect(() => {
    if (authStore.isAuthenticated) push('/');
  });
</script>
```

`onMount` is still useful for one-shot initialisation (like attaching DOM listeners).

### F. Bind to events, not directives

Svelte 5 changed event syntax: `on:click` → `onclick`. Old `on:event` still works (legacy) but new code should use the simpler form:

```svelte
<button onclick={onLogout}>Logout</button>
<form onsubmit={onSubmit}>...</form>
```

## Common patterns

### Adding a new API module

```ts
// src/lib/api/orders.ts
import { apiRequest } from './client';

export async function getOrders(page = 0): Promise<Order[]> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', '20');
  // Bonita 2025.x: repeat `o` per criterion (NOT comma-separated)
  params.append('o', 'creationDate DESC');
  return apiRequest<Order[]>(`/extension/orders/list?${params}`);
}
```

### Adding a protected page

1. Create `src/lib/pages/MyPage.svelte`
2. In `App.svelte`, the route is already `'*': Layout`. Inside Layout you can switch on `location.pathname` or use `<Route>` blocks per page.
3. For a more granular setup, add the route to the routes map in `App.svelte`.

## Troubleshooting (Svelte-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `$state is not defined` | File is `.ts` instead of `.svelte.ts` | Rename the file to `.svelte.ts` |
| `(deprecated) new App({...})` warning | Using legacy bootstrap | Replace `new App(...)` with `mount(App, { target })` |
| Reactive updates don't propagate to the template | Mutating without runes (e.g. `arr.push(x)`) | Re-assign: `arr = [...arr, x]`. Or use `$state.snapshot()` for a non-reactive view |
| Router shows a flash of `/login` before content | App rendered before session probe completed | Show a `Loading…` placeholder while a `booted` flag is false |
| `Cannot find module 'svelte/store'` | Trying to import legacy stores in Svelte 5 | Use the runes class pattern instead |
| Hash mode resets to `/` after refresh | Used the parent's URL hash mistakenly | The iframe's own hash is what matters; svelte-spa-router reads it correctly |
| HTTP 500 on multi-criterion `o=` | Bonita 2025.x parser rejects commas | `params.append('o', 'a DESC'); params.append('o', 'b ASC')` |

For framework-agnostic issues (CORS, 401, blank page in prod, etc.) see `../bonita-custom-page/references/deployment.md`.

## Reference example

A complete working example lives at [`../../examples/svelte-directory-bonita/`](../../examples/svelte-directory-bonita/) — login + session probe + task list + logout + multilingual deploy docs. Bundle: ~20 KB gzip / 22 KB ZIP.

## Deployment quick reference (Bonita 2025.x)

After `npm run dist`:

1. `/bonita/apps/superAdminAppBonita/resource-list/` → +Add → upload the ZIP
2. `/bonita/apps/superAdminAppBonita/application-list/` → +Create app, **Layout = `Layout Without Menu`**
3. `admin-application-details/?id={id}` → Pages → +Add → token `home`
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
