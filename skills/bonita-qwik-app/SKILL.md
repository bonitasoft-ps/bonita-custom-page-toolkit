---
name: bonita-qwik-app
description: Use when the user wants to create a new Qwik application for Bonita, scaffold a Qwik custom page in SPA-only mode, or set up a Vite + Qwik project served by Bonita's Tomcat. Covers Qwik-specific scaffolding (NO Qwik City, useVisibleTask$ for bootstrap, MODULE-LEVEL helper functions). Delegates the framework-agnostic parts to bonita-custom-page.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|wrap|explain> [app-name]"
---

# Bonita Qwik App — custom page skill

You are an expert in building Qwik (in SPA-only mode) + Vite + TypeScript applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/`.

This skill covers only what is **Qwik-specific**.

> **CRITICAL CONTEXT**: Qwik's headline feature is *resumability* — the framework lazy-loads function bodies one chunk per closure. This is amazing for huge sites BUT introduces constraints that don't exist in any other framework. Two of them are deadly for Bonita custom pages and we learned them painfully:
>
> 1. `useTask$` doesn't fire on first render in SPA mode → use `useVisibleTask$` instead
> 2. Component-local async functions (even wrapped in `$()`) **fail at runtime** when invoked from another QRL chunk → put reusable async functions at MODULE level
>
> Both are documented as rules below. Don't skip them.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite + `@builder.io/qwik/optimizer` (`qwikVite`) | Qwik's compiler runs as a Vite plugin |
| Mode | **SPA-only** (NO Qwik City) | Qwik City is SSR/file-routing — incompatible with custom pages. We use core Qwik with `render(document, <Root />)` |
| UI | Qwik core with JSX | Reactive primitives are signals (`useSignal`), stores (`useStore`), and computed (`useComputed$`) |
| Components | None by default — plain CSS | Qwik's edge is small initial JS + lazy-loaded chunks |
| Router | Manual hash-based routing inside the root component | No `@builder.io/qwik-city` (it brings SSR/file routing). For 1-3 pages, a `route` signal is enough. |
| State | `useStore` + `useSignal` | Module-level helpers receive signals as parameters |
| HTTP | `fetch` | Native, no extra dep |

## Activation flow

1. **Determine the action**: scaffold a new Qwik SPA, wrap an existing one, or explain a pattern?
2. **Confirm the user knows the constraints** (see the CRITICAL CONTEXT box above) — Qwik's mental model differs.
3. **Ask the questions in §"Questions to ask before generating"**.
4. **Read the foundational skill** `../bonita-custom-page/SKILL.md`.

## Questions to ask before generating

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | What is the **page name** in camelCase? | Becomes `custompage_<name>` and ZIP filename |
| 2 | What is the **display name**? | Bonita admin label |
| 3 | What is the **Application token**? | URL: `/bonita/apps/{appToken}/{pageToken}/` |
| 4 | What is the **page token**? | Default: `home` |
| 5 | Brand-new project or **wrap existing**? | `scaffold` vs `wrap` |
| 6 | Where should the project live? | Default: `./{name}` |
| 7 | Bonita version: 2025.x or 7.x? | Affects deployment URLs |
| 8 | **Are you sure Qwik is the right tool here?** Confirm with the user. | Qwik shines for very large pages with low interactivity. For small custom pages, **Svelte or Solid usually deliver smaller bundles AND simpler code**. Don't pick Qwik because it's new — pick it because the page is heavy and first-paint speed matters. |

**Don't proceed without 1, 3, 5, AND a confirmed answer to 8**.

## Scaffolding a new project

### Step 1 — initialize

```bash
mkdir {app-name} && cd {app-name}
npm init -y
npm install @builder.io/qwik
npm install -D vite typescript archiver @types/node
```

(Don't use `npm create qwik@latest` — that scaffolds Qwik City, not what we want.)

### Step 2 — project structure

```
src/
├── api/
│   ├── client.ts          ← fetch wrapper
│   ├── auth.ts            ← login / getSession / logout
│   └── tasks.ts           ← Domain calls
├── root.tsx               ← THE component$ — entire app lives here for small SPAs
├── entry.tsx              ← render(document.getElementById('app'), <Root />)
└── app.css
```

For larger apps, split by feature inside `src/components/` etc. — but unlike React/Vue/Solid, **don't break out reusable async functions into their own files unless they're MODULE-level** (see rule G below).

### Step 3 — apply the templates

- [`references/spa-mode.md`](references/spa-mode.md) — `vite.config.ts` and `qwikVite()` for SPA-only build
- [`references/visible-task.md`](references/visible-task.md) — Why `useVisibleTask$` is mandatory for bootstrap
- [`references/module-level-helpers.md`](references/module-level-helpers.md) — The fix for `loadTasks is not defined`
- [`references/api-client.md`](references/api-client.md) — Standard fetch wrapper (no Qwik specifics)

For ZIP packaging, page.properties, deployment, see `../bonita-custom-page/references/`.

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

## Qwik-specific rules (in addition to the universal seven)

### A. SPA-only mode — no Qwik City

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';

export default defineConfig({
  base: './',
  plugins: [qwikVite({ client: { outDir: 'dist' } })],
  build: { rollupOptions: { input: ['./index.html'] } },
  server: { port: 5173, proxy: { '/bonita': { target: 'http://localhost:8080' } } },
});
```

The `client.outDir` setting tells Qwik where to emit. The `rollupOptions.input` ensures Vite uses our `index.html` as the entry, not Qwik's default SSR entry.

### B. Bootstrap with `render`, not Qwik's SSR `renderToStream`

```tsx
// src/entry.tsx
import { render } from '@builder.io/qwik';
import Root from './root';
import './app.css';

render(document.getElementById('app')!, <Root />);
```

`render(target, jsx)` is the SPA mount API. The standard Qwik City template uses `renderToStream` — that's for SSR.

### C. `src/root.tsx` is mandatory

The Qwik optimizer looks for `src/root.tsx` by default. Even though you bootstrap from `entry.tsx`, the file `root.tsx` (exporting a `component$()`) must exist or build fails with `Qwik input "src/root" not found`.

### D. ⚠️ `useTask$` does NOT run on first render in SPA mode — use `useVisibleTask$`

```tsx
// ❌ DOESN'T FIRE on first render without SSR
useTask$(async ({ track }) => {
  track(() => auth.booted);
  // ...session probe...
});

// ✅ FIRES in the browser as soon as the component is visible
// eslint-disable-next-line qwik/no-use-visible-task
useVisibleTask$(async () => {
  // ...session probe...
});
```

`useTask$` only re-runs when a tracked signal changes. With no SSR, the first signal-state pair is whatever the component initialised — there's no "change" to react to. Result: the bootstrap never runs.

`useVisibleTask$` fires on first paint AND on subsequent hydrations — exactly what we need.

### E. ⚠️ Reusable async functions must be MODULE-level, NOT component-local

This is the rule that breaks Qwik newcomers most:

```tsx
// ❌ FAILS at runtime: "loadTasks is not defined"
export default component$(() => {
  const tasks = useSignal([]);
  const loadTasks = $(async () => {        // ← even with $() wrap
    tasks.value = await api.getTasks();
  });
  useVisibleTask$(async () => { await loadTasks(); });  // ← fails here
});

// ✅ Define at module level — Qwik resolves by import path across chunks
async function loadTasks(out: { tasks: Signal<Task[]> }) {
  out.tasks.value = await api.getTasks();
}

export default component$(() => {
  const tasks = useSignal<Task[]>([]);
  useVisibleTask$(async () => { await loadTasks({ tasks }); });
  return <button onClick$={async () => loadTasks({ tasks })}>Refresh</button>;
});
```

**Rule of thumb**: any async function called from MORE THAN ONE QRL site (event handler, useTask$, useVisibleTask$) goes to module level. Pass signals as parameters in a "bag" object.

**Inline arrow functions inside `onClick$`/`onSubmit$`** are FINE — Qwik chunks them per call site, and they reference module-level helpers by import path.

This is the fix that worked after `$()` wrapping failed. Full explanation: [`references/module-level-helpers.md`](references/module-level-helpers.md).

### F. Drop `frame-ancestors` from the CSP `<meta>` tag

Browsers ignore `frame-ancestors` when delivered via `<meta>` and emit a console warning. Bonita controls iframe embedding via response headers anyway. The other CSP directives (`script-src`, `style-src`, etc.) DO work from `<meta>`.

```html
<!-- ✅ no frame-ancestors here -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ..." />
```

### G. State patterns

```tsx
import { useSignal, useStore } from '@builder.io/qwik';

// Single value → useSignal
const count = useSignal(0);
count.value++;          // mutate via .value

// Object with multiple fields → useStore
const auth = useStore({ user: null, booted: false });
auth.user = newUser;    // direct field assignment, deep proxy
```

Don't try to share `useSignal`/`useStore` across components by exporting from a module — that breaks Qwik's serialisation. Pass them as props or via context.

## Common patterns

### Adding a new API call

```ts
// src/api/orders.ts
import { apiRequest } from './client';

export async function getOrders(page = 0): Promise<Order[]> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', '20');
  // Bonita 2025.x: repeat `o` per criterion
  params.append('o', 'creationDate DESC');
  return apiRequest<Order[]>(`/extension/orders/list?${params}`);
}
```

### Adding a new page (small app)

For a 2-3 page custom page, keep everything in `root.tsx` with a `route` signal:

```tsx
const route = useSignal<'login' | 'home' | 'orders'>('login');

return (
  <>
    {route.value === 'login' && <LoginScreen />}
    {route.value === 'home' && <HomeScreen />}
    {route.value === 'orders' && <OrdersScreen />}
  </>
);
```

For more pages, consider Qwik City after all — but at that point you're outside SPA-only mode and need a full SSR setup.

## Troubleshooting (Qwik-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Qwik input "src/root" not found` | Missing `src/root.tsx` | Create it; Qwik's optimizer requires the file |
| App stuck on "Loading…" forever, no API call | `useTask$` for bootstrap in SPA mode | Switch to `useVisibleTask$` |
| `QWIK ERROR loadTasks is not defined` at runtime | Component-local async function called from another QRL | Move to MODULE level (rule E) |
| Console warning about `frame-ancestors` ignored | CSP `<meta>` includes `frame-ancestors` | Remove that directive from `<meta>` (rule F) |
| `vite's config.base must begin and end with /` | Vite warns about `base: './'` for build | Harmless — Qwik handles relative paths regardless |
| HTTP 500 on multi-criterion `o=` | Bonita 2025.x rejects commas | `params.append('o', 'a DESC')` per criterion |
| Build emits `q-manifest.json` | Normal — Qwik's chunk graph metadata | Don't ship to Bonita: it's already inside `dist/` and gets included in the ZIP. Harmless. |

## When to NOT pick Qwik

Qwik is the right choice when **first-paint speed dominates** and **most users only interact with a fraction of the page**. For a typical Bonita custom page (login form + table of tasks):

- **Solid** delivers a smaller bundle (14 KB vs 25 KB gzip)
- **Svelte 5** has a friendlier syntax with similar bundle size

The numbers in [`../../COMPARISON.md`](../../COMPARISON.md) show this clearly. Recommend Qwik to the user only when they have a heavy page (many widgets, charts) AND care about cold-start performance more than developer ergonomics.

## Reference example

A complete working example lives at [`../../examples/qwik-directory-bonita/`](../../examples/qwik-directory-bonita/). Bundle: ~25 KB gzip / 33 KB ZIP, auto-split into 9 lazy chunks.

## Deployment quick reference (Bonita 2025.x)

After `npm run dist`:

1. `/bonita/apps/superAdminAppBonita/resource-list/` → +Add → upload the ZIP
2. `/bonita/apps/superAdminAppBonita/application-list/` → +Create app, **Layout = `Layout Without Menu`**
3. `admin-application-details/?id={id}` → Pages → +Add → token `home`
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
