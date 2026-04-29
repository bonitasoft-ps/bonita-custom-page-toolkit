---
name: bonita-solid-app
description: Use when the user wants to create a new SolidJS application for Bonita, scaffold a Solid custom page, or set up a Vite + SolidJS project served by Bonita's Tomcat. Covers Solid-specific scaffolding (createSignal, createStore, @solidjs/router HashRouter), and the deployment flow. Delegates the framework-agnostic parts to bonita-custom-page.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|wrap|explain> [app-name]"
---

# Bonita SolidJS App — custom page skill

You are an expert in building SolidJS + Vite + TypeScript applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/`.

This skill covers only what is **Solid-specific**.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite + `vite-plugin-solid` | Fast HMR, hashed assets |
| UI | SolidJS + JSX | React-like syntax, no Virtual DOM, fine-grained reactivity |
| Components | None by default — plain CSS | Solid's bundle is ~14 KB gzip; adding heavy UI libs defeats the point |
| Router | `@solidjs/router` (`HashRouter`) | Hash routing required for iframe deployment. Lightweight (~5 KB) |
| State | `createSignal` (local) + `createStore` (shared/object-shaped) | The `createStore` pattern is what makes a "store" object with multiple fields |
| HTTP | `fetch` | Native — no extra dep |

## Activation flow

1. **Determine the action**: scaffold a new app, wrap an existing one, or explain a pattern?
2. **Ask the questions in §"Questions to ask before generating"** — don't assume names.
3. **Read the foundational skill** `../bonita-custom-page/SKILL.md`.
4. **Apply Solid idioms**: signals everywhere, JSX-with-no-VDOM mental model.

## Questions to ask before generating

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | What is the **page name** in camelCase? | Becomes `custompage_<name>` and the ZIP filename |
| 2 | What is the **display name**? | Bonita admin label, defaults to page name |
| 3 | What is the **Application token** in Bonita? | URL: `/bonita/apps/{appToken}/{pageToken}/` |
| 4 | What is the **page token**? | Default: `home` |
| 5 | Brand-new project or **wrap existing**? | Determines `scaffold` vs `wrap` |
| 6 | Where should the project live? | Default: `./{name}` |
| 7 | Bonita version: **2025.x** or **7.x**? | Affects deployment URLs |
| 8 | Do you need a **component library** (SolidUI, Hope UI)? | Default no — Solid's edge is a tiny bundle |

**Don't proceed without 1, 3, and 5**.

## Scaffolding a new project

### Step 1 — initialize

```bash
npm create vite@latest {app-name} -- --template solid-ts
cd {app-name}
npm install @solidjs/router
npm install -D archiver @types/node
```

### Step 2 — project structure

```
src/
├── api/
│   ├── client.ts          ← fetch wrapper with CSRF
│   ├── auth.ts            ← login / getSession / logout
│   └── tasks.ts           ← Domain API calls
├── stores/
│   └── auth.ts            ← createStore-based auth state
├── pages/
│   ├── LoginPage.tsx
│   └── TasksPage.tsx
├── App.tsx                ← Layout + route guard
├── index.tsx              ← render() with HashRouter root
├── app.css                ← All global + layout styles
└── vite-env.d.ts
```

### Step 3 — apply the templates

- [`references/stores.md`](references/stores.md) — `createStore` pattern + getters that expose signals
- [`references/api-client.md`](references/api-client.md) — same `fetch` wrapper, no Solid-specific bits
- [`references/router.md`](references/router.md) — `HashRouter` setup with `@solidjs/router`
- [`references/styles-pattern.md`](references/styles-pattern.md) — All-styles-in-one-CSS pattern (avoiding `<style>` blocks)

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

## Solid-specific rules (in addition to the universal seven)

### A. `HashRouter` from `@solidjs/router`, not browser router

```tsx
import { HashRouter, Route } from '@solidjs/router';
import App from './App';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';

render(
  () => (
    <HashRouter root={App}>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={TasksPage} />
      <Route path="*" component={TasksPage} />
    </HashRouter>
  ),
  document.getElementById('root')!
);
```

### B. `createStore` for shared object-shaped state

For an auth store (multiple fields, methods that mutate them), use `createStore` not multiple `createSignal`s:

```ts
import { createStore } from 'solid-js/store';

const [state, setState] = createStore({ user: null, isLoading: true });

export const authStore = {
  get user() { return state.user; },
  get isAuthenticated() { return state.user !== null; },
  setUser(u) { setState('user', u); },
};
```

The getters (`get user()`) keep the API ergonomic — `authStore.user` returns the reactive value.

### C. Components MUST call signals as functions (`signal()`, not `signal`)

```tsx
const [count, setCount] = createSignal(0);

return <p>{count()}</p>;        // ✅ tracks the signal
return <p>{count}</p>;          // ❌ renders "[object Function]" — does not track
```

This is THE most common Solid mistake from React devs. Always call signals.

### D. `<Show>` and `<For>` for conditional / list rendering

```tsx
<Show when={authStore.isAuthenticated} fallback={<LoginPrompt />}>
  <Dashboard />
</Show>

<For each={tasks()}>
  {(task) => <TaskRow task={task} />}
</For>
```

`{condition && <X />}` works but doesn't optimize. `<Show>` is the idiomatic Solid form.

### E. ⚠️ Put ALL styles in `app.css`, not in component `<style>` blocks

This is a learned-the-hard-way rule for Solid + Bonita custom pages:

```tsx
// ❌ DOESN'T WORK reliably for Bonita-deployed Solid pages
function MyPage() {
  return (
    <div>
      <h1>Title</h1>
      <style>{`h1 { color: red }`}</style>  {/* fragile */}
    </div>
  );
}

// ✅ DO put rules in src/app.css and import once in src/index.tsx
```

Reasons:
- The `<style>` blob inside a component is global once the component mounts; if the component never mounts (e.g. blocked by a guard), the styles are missing
- `app.css` is loaded by Vite as a separate hashed CSS file — Bonita serves it correctly
- All-in-one CSS is much easier to maintain for a custom page (~5 KB total)

Define `:root` tokens in `app.css`, every layout class (`.layout`, `.topbar`, `.card`, ...), and only use inline `style={{}}` for truly one-off dynamic styles.

### F. Use `createEffect` for reactive side effects, NOT `onMount` alone

```tsx
import { createEffect, onMount } from 'solid-js';

// One-shot init
onMount(() => {
  setSessionExpiredHandler(() => navigate('/login'));
});

// Re-runs when authStore.user changes
createEffect(() => {
  if (authStore.user?.userId) loadTasks();
});
```

## Common patterns

### Adding a new API module

```ts
// src/api/orders.ts
import { apiRequest } from './client';

export async function getOrders(page = 0): Promise<Order[]> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', '20');
  // Bonita 2025.x: repeat `o`, NOT comma-separated
  params.append('o', 'creationDate DESC');
  return apiRequest<Order[]>(`/extension/orders/list?${params}`);
}
```

### Adding a protected page

```tsx
// src/index.tsx
<HashRouter root={App}>
  <Route path="/login" component={LoginPage} />
  <Route path="/" component={TasksPage} />
  <Route path="/orders" component={OrdersPage} />
  <Route path="*" component={TasksPage} />
</HashRouter>
```

The `App` component (root) handles the auth guard once for all routes nested under it.

## Troubleshooting (Solid-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Template renders `[object Function]` | Forgot to call the signal: `{count}` instead of `{count()}` | Always call: `{count()}` |
| Effects don't re-run | Reading the signal outside of a tracking scope (e.g. in a setTimeout that resolves later) | Read inside `createEffect` or move the read up |
| Styles missing — header looks broken | `<style>` block inside a component that's unmounted by a guard | Put all CSS in `src/app.css` |
| `Cannot read properties of undefined` on first render | Reading a store field that's null without `?.` | Use optional chaining: `authStore.user?.userId` |
| Hash mode resets to `/` | Used `Router` (browser) instead of `HashRouter` | Switch to `HashRouter` from `@solidjs/router` |
| HTTP 500 on multi-criterion `o=` | Bonita 2025.x rejects commas | `params.append('o', 'a DESC')` per criterion |

For framework-agnostic issues see `../bonita-custom-page/references/deployment.md`.

## Reference example

A complete working example lives at [`../../examples/solid-directory-bonita/`](../../examples/solid-directory-bonita/). Bundle: ~14 KB gzip / 16 KB ZIP — the **smallest of the six frameworks** in this toolkit.

## Deployment quick reference (Bonita 2025.x)

After `npm run dist`:

1. `/bonita/apps/superAdminAppBonita/resource-list/` → +Add → upload the ZIP
2. `/bonita/apps/superAdminAppBonita/application-list/` → +Create app, **Layout = `Layout Without Menu`**
3. `admin-application-details/?id={id}` → Pages → +Add → token `home`
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
