# Pre-flight checklist: preparing your existing project for `bonita-page wrap`

> Idiomas / Languages / Langues: **[English (this document)]** · [Castellano](WRAP-CHECKLIST.es.md) · [Français](WRAP-CHECKLIST.fr.md)

This document is for **developers who already have a React / Vue / Angular / Svelte / SolidJS / Qwik project** and want to package it as a Bonita custom page using the toolkit's `bonita-page wrap` command.

It tells you exactly what your project needs to look like **before** running `wrap`, so the wrap step can succeed and your ZIP deploys cleanly to Bonita 2025.x without any AI involvement.

> **Why this exists.** `bonita-page wrap` only adds the Bonita layer (page.properties, packaging script, deploy docs, build helpers). It does NOT modify your `src/` code. If your project doesn't already conform to the rules below, the wrap will succeed but the deployed ZIP will fail at runtime. The fastest path is to fix any issues in `src/` first, then wrap.

---

## Express path (one command)

If your team is confident the project conforms to the rules, you can skip the manual verification and use the orchestrator:

```bash
cd /path/to/your/project
/path/to/bonita-custom-page-toolkit/bonita-page.sh prepare \
    --name=myDashboard \
    --app-token=myApp
# → runs: check, wrap, npm install, npm run dist
# → produces dist/page-myDashboard.zip + DEPLOY-README.{md,html}
```

If `prepare` aborts in the `check` stage, you'll know exactly what to fix (the command lists the issues and stops). Apply the relevant `Manual fixes per framework` below and re-run.

If you prefer running the steps individually (more control, same result):

```bash
bonita-page check                                  # 1. Verify
bonita-page wrap --name=myDashboard --app-token=myApp  # 2. Add Bonita layer
npm install                                        # 3. Dependencies
npm run dist                                       # 4. Build the ZIP
```

---

## TL;DR — the 8-line check

Run these in your project root. If they all pass, you're ready to `wrap`:

```bash
# 1. The project builds. (Adjust if your script is named differently.)
npm run build

# 2. The build emits a single index.html and a hashed assets folder.
ls dist                 # Vite frameworks
ls dist/<app>/browser   # Angular

# 3. The build's index.html uses RELATIVE asset paths (./assets/...) NOT (/assets/...)
grep -o 'src="[^"]*"' dist/index.html | head -3   # should start with "./"

# 4. Your routing uses HASH mode (no surprise 404 on refresh inside Bonita).
#    Look for one of:
grep -rE "createHashRouter|HashRouter|createWebHashHistory|HashLocationStrategy|svelte-spa-router|@solidjs/router.*HashRouter" src/

# 5. Every fetch / HttpClient call sends credentials + the CSRF token.
#    Search for one of these in your HTTP layer:
grep -rE "credentials: ['\"]include|withCredentials|X-Bonita-API-Token" src/
```

If 1-3 fail → see §"Manual fixes per framework" below. 4-5 → see §"What `wrap` does NOT touch".

For an automated version of this check, run:

```bash
bonita-page check         # exits 0 on pass, 1 with a JSON report on issues
```

---

## What your project must satisfy (the seven rules + Bonita 2025.x extras)

These rules are universal across all six supported frameworks. Skipping any of them produces a ZIP that builds but fails at runtime.

### 1. Build with relative base paths

Bonita serves your custom page from a deep nested URL like `/bonita/portal/resource/page/{profile}/{name}/content/`. Absolute asset paths (`/assets/index.js`) resolve to `/assets/...` — outside the page directory — and 404.

| Framework | Where | Value |
|-----------|-------|-------|
| Vite (React/Vue/Svelte/Solid/Qwik) | `vite.config.ts` → `base` | `'./'` (or `command === 'build' ? './' : '/'`) |
| Angular | `angular.json` → `architect.build.options.baseHref` | `'./'` |

**How to verify**: open `dist/index.html` (or `dist/<app>/browser/index.html` for Angular) after a build. The `<script src="...">` and `<link href="...">` tags should start with `./` (or be plain filenames). If they start with `/`, the build is wrong.

### 2. Hash routing, never browser/HTML5 routing

Bonita's Tomcat doesn't rewrite unknown URLs to `index.html`. With browser routing, refreshing `/tasks/123` returns 404 because Tomcat looks for a literal `tasks/123` resource.

| Framework | What to use |
|-----------|-------------|
| React | `createHashRouter` from `react-router-dom` v7 (NOT `createBrowserRouter`) |
| Vue | `createWebHashHistory()` (NOT `createWebHistory()`) |
| Angular | `provideRouter(routes, withHashLocation())` — or `{ provide: LocationStrategy, useClass: HashLocationStrategy }` |
| Svelte | `svelte-spa-router` (npm package, hash-based by design) |
| SolidJS | `<HashRouter>` from `@solidjs/router` (NOT plain `<Router>`) |
| Qwik | Manual: a `route` signal in your root component (Qwik City is incompatible with custom pages) |

### 3. Every API call uses the relative `/bonita/API/...` path

Hardcoding `http://localhost:8080` breaks production. Hardcoding the production URL breaks dev. The toolkit examples use a single base constant:

```ts
const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';
```

For Angular: same idea, just use a relative URL in `HttpClient.get('/bonita/API/...')`.

### 4. `credentials: 'include'` on every request

Bonita's `JSESSIONID` and `X-Bonita-API-Token` cookies don't get sent without it.

| Framework | Where |
|-----------|-------|
| All `fetch`-based | `fetch(url, { credentials: 'include' })` on every call |
| Angular | `withCredentials: true` set by an HTTP interceptor — see `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts` |

### 5. CSRF token: read cookie, send as header

Every mutating request (POST/PUT/DELETE) needs the `X-Bonita-API-Token` header echoing the same-named cookie:

```ts
const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
if (match) headers['X-Bonita-API-Token'] = decodeURIComponent(match[1]);
```

Some sites also set this on GET (harmless and simpler).

### 6. ZIP layout — `wrap` enforces this for you

`page.properties` at the ZIP root, build output under `resources/`. The packaging script `wrap` adds (`scripts/package-bonita.js`) handles this automatically. The only thing you do is: run the build, then `npm run dist`.

### 7. CSP `<meta>` — careful with two directives

Two non-obvious rules:

- **Don't include `frame-ancestors`** in your `<meta http-equiv="Content-Security-Policy">`. Browsers ignore it from `<meta>` and emit a console warning. Bonita Tomcat sets the proper response header.
- **For Angular only**: include `'unsafe-inline'` in `script-src`. Angular's runtime registers some click handlers as inline DOM attributes that the browser treats as inline scripts. Without `'unsafe-inline'`, every click is blocked. React/Vue/Svelte/Solid/Qwik don't need this.

A working CSP meta for Angular:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; base-uri 'self'; form-action 'self'" />
```

For the others, drop the `'unsafe-inline'` after `script-src 'self'`.

### Bonita 2025.x extras

- **REST API ordering / filtering**: the `o=` query param is parsed strictly — repeat per criterion (`?o=A DESC&o=B ASC`), never comma-separate (`?o=A DESC,B ASC` returns 500). Also: search descriptor names ≠ response field names, so when in doubt **drop `o=`/`f=`/`d=` entirely** and sort/filter client-side. The toolkit's bundled `bpm.ts` does this defensively.
- **Layout Without Menu**: when creating the Bonita Application that hosts your page, pick the built-in `Layout Without Menu` (in `superAdminAppBonita/application-list/`). Otherwise the default layout wraps your SPA with Bonita's chrome.

---

## What `bonita-page wrap` adds (so you don't write it)

When you run `wrap`, it creates these files at your project root:

```
your-project/
├── page.properties              ← name, displayName, description, contentType
├── docs/
│   ├── DEPLOY-README.md         ← step-by-step deploy in EN/FR/ES
│   └── DEPLOY-README.html       ← same content, browseable HTML
├── scripts/
│   ├── package-bonita.js        ← Builds the ZIP with the layout Bonita expects
│   └── copy-docs.js             ← Copies DEPLOY-README files next to the ZIP
├── build.sh                     ← One-command install + build + dist
└── build.bat                    ← Same, for Windows
```

It also modifies your `package.json`:
- Adds `dist` script: `npm run build:bonita && node scripts/copy-docs.js`
- Adds `build:bonita` script: `vite build && node scripts/package-bonita.js` (or the Angular equivalent)
- Adds `archiver` (and `cross-env` for Angular) to `devDependencies`

**Nothing under `src/` is touched.** If your code violates one of the seven rules above, `wrap` won't fix it — it'll just print a warning. Apply the manual fix in §"Manual fixes per framework" first.

---

## What `bonita-page wrap` does NOT touch (so you must)

`wrap` is intentionally non-destructive. It does NOT:
- Replace `BrowserRouter` with `HashRouter`
- Add `'./'` to your Vite or Angular base path
- Add `credentials: 'include'` or a CSRF interceptor
- Set up your auth store or session probe
- Configure the Bonita session-expired handler

For each missing piece, go to your framework's skill in [`skills/bonita-{framework}-app/`](../skills/) — they have ready-to-paste templates and explanations.

---

## Manual fixes per framework

### React + Vite

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  // ...
}));
```

```tsx
// router.tsx
import { createHashRouter } from 'react-router-dom';
export const router = createHashRouter([ /* ... */ ]);
```

For the API client, copy `examples/react-directory-bonita/src/api/client.ts` — it's plain `fetch` with `credentials: 'include'` and CSRF token handling.

### Vue 3 + Vite

```ts
// vite.config.ts
base: './',
```

```ts
// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router';
const router = createRouter({ history: createWebHashHistory(), routes });
```

For watchers reacting to auth state, use `{ immediate: true }` (otherwise pages stay empty on first load):
```ts
watch(() => auth.user?.userId, (id) => { if (id) load(); }, { immediate: true });
```

### Angular 18+ standalone

```json
// angular.json — projects.<your-app>.architect.build.options
{ "baseHref": "./" }
```

```ts
// app.config.ts
provideRouter(routes, withHashLocation()),
provideHttpClient(withInterceptors([authInterceptor])),

// CRITICAL: probe the Bonita session as APP_INITIALIZER, NOT in
// AppComponent.ngOnInit, otherwise the auth guard runs before the
// probe finishes and bounces every user to /login.
{
  provide: APP_INITIALIZER,
  useFactory: (store: AuthStore) => () => store.loadSession(),
  deps: [AuthStore],
  multi: true,
},
```

The HTTP interceptor sets `withCredentials` and the CSRF header — copy `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts`.

CSP: include `'unsafe-inline'` in `script-src` (see §7 above).

### Svelte 5

```ts
// vite.config.ts
base: './',
```

```svelte
<!-- App.svelte -->
<script>
  import Router from 'svelte-spa-router';
  // routes use plain hash paths like '/login', '/tasks/:id'
</script>
<Router {routes} />
```

Use `.svelte.ts` extension for any module containing runes (`$state`, `$derived`).

### SolidJS + Vite

```ts
// vite.config.ts
base: './',
```

```tsx
// src/index.tsx
import { HashRouter, Route } from '@solidjs/router';
render(() => <HashRouter root={App}>{/* routes */}</HashRouter>, root);
```

Put ALL CSS in `src/app.css`, NOT in `<style>` blocks inside individual components — components mounted later (e.g. behind a `<Show>` guard) inject their styles too late, breaking the layout.

### Qwik (SPA-only mode)

```ts
// vite.config.ts
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({
  base: './',
  plugins: [qwikVite({ client: { outDir: 'dist' } })],
  build: { rollupOptions: { input: ['./index.html'] } },
});
```

Reusable async functions (called from multiple QRLs) MUST be defined at MODULE level, NOT inside `component$()`. Qwik fails at runtime with `X is not defined` otherwise. Pass the signals you need to mutate as parameters:

```tsx
async function loadData(out: { items: Signal<Item[]>; loading: Signal<boolean> }) {
  out.loading.value = true;
  try { out.items.value = await api.list(); }
  finally { out.loading.value = false; }
}

export default component$(() => {
  const items = useSignal<Item[]>([]);
  const loading = useSignal(false);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => { await loadData({ items, loading }); });
});
```

Use `useVisibleTask$` (NOT `useTask$`) for the bootstrap probe — `useTask$` doesn't fire on first render in SPA mode.

---

## Pre-flight script (for CI / scripted environments)

A one-shot Node script that fails the build if any of the seven rules are violated:

```bash
# From your project root
bonita-page check

# Sample output on success
{
  "ok": true,
  "framework": "react",
  "checks": {
    "buildOutputExists": true,
    "relativeBasePath": true,
    "hashRouting": true,
    "credentialsInclude": true
  }
}

# Sample output on issues (exit code 1)
{
  "ok": false,
  "framework": "react",
  "issues": [
    "vite.config.ts: `base` is not './' (or computed for build). Deployed assets will 404.",
    "src/router.tsx: createBrowserRouter found — use createHashRouter for refresh-safe deployment in Bonita."
  ]
}
```

Use this in CI:
```yaml
- run: npm run build
- run: npx bonita-page check     # blocks PR merge if config drifts
```

---

## After your project passes the checklist

```bash
bonita-page wrap \
    --framework=react \
    --name=invoiceDashboard \
    --display-name="Invoice Dashboard" \
    --app-token=invoiceApp

# Wraps in place. Then:
npm install                     # picks up archiver and any new devDeps
npm run dist                    # builds + packages + writes deploy docs
# → dist/page-invoiceDashboard.zip + dist/DEPLOY-README.{md,html}
```

Hand off the ZIP + DEPLOY-README files to whoever deploys to Bonita. They follow the bilingual deploy guide step by step in `dist/DEPLOY-README.html` — no AI, no internet, just a browser.

---

## Why this layout works for AI workflows too

When an AI agent (Claude with the MCP tools) wraps a project, it follows the same pre-flight checks as a human. Every rule above maps to one of the warnings emitted by `wrap.js` and `check.js`. The agent doesn't have to re-discover the rules from scratch — it reads this checklist, runs the verification script, and knows what (if anything) to ask the user about.

In practice this means:
- **Less token cost** — the agent verifies a finite list instead of doing exploratory search
- **Reproducible across runs** — same inputs, same outputs, regardless of model version
- **Auditable** — the human-readable JSON report tells the user exactly why the wrap succeeded or didn't

If you're considering writing your own AI agent that wraps SPAs as Bonita custom pages, point it at this document and the corresponding skill files in `skills/`. The skill knowledge plus this checklist plus the CLI source in `scripts/` is the entire contract the agent needs.
