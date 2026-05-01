---
name: bonita-custom-page
description: Foundational knowledge for building any SPA (React, Vue, Angular, Svelte, Solid, Qwik) as a Bonita custom page. Covers the architecture, ZIP layout, page.properties, Bonita REST APIs (auth, session, CSRF), iframe constraints and deployment. Loaded by the framework-specific skills (bonita-react-app, bonita-vue-app, bonita-angular-app, bonita-svelte-app, bonita-solid-app, bonita-qwik-app) to avoid duplicating the parts that are identical across frameworks.
allowed-tools: Read, Grep, Glob
user-invocable: false
---

# Bonita Custom Page — Foundational Skill

You are an expert in deploying single-page applications as Bonita custom pages. This skill contains the **framework-agnostic** knowledge — every Bonita SPA, regardless of framework, must follow the same rules around routing, paths, auth, packaging and deployment.

The framework-specific skills (`bonita-react-app`, `bonita-vue-app`, `bonita-angular-app`, `bonita-svelte-app`, `bonita-solid-app`, `bonita-qwik-app`) reference this skill for the common parts.

## Questions to ask BEFORE doing anything

When the user asks to "create a Bonita custom page" or similar, gather these answers first. **Don't assume** — ask. Most failed Bonita deployments come from missed defaults.

### Always ask these (1-5)

| # | Question | Notes |
|---|----------|-------|
| 1 | **Which framework**? React, Vue, Angular, Svelte, Solid, or Qwik? | If they're unsure, recommend based on team experience and `COMPARISON.md`. Don't push your favourite. |
| 2 | What is the **page name** in camelCase? (e.g. `invoiceDashboard`) | Becomes `custompage_<name>` and the ZIP filename. Must match `[a-zA-Z][a-zA-Z0-9]*`. |
| 3 | What is the **display name** shown in Bonita admin? | Free text. Defaults to the page name. |
| 4 | What is the **Bonita Application token**? (e.g. `myApp`) | The `{appToken}` in `/bonita/apps/{appToken}/{pageToken}/`. The user creates this in Bonita admin too. |
| 5 | Is this a **brand-new project** or wrapping an **existing** SPA? | New → `bonita-page scaffold`. Existing → `bonita-page wrap`. |

### Ask if relevant (6-11)

| # | Question | Notes |
|---|----------|-------|
| 6 | What is the **page token** within the application? | Default: `home`. The `{pageToken}` in the URL. |
| 7 | Where should the project live? (target directory) | Default: `./{name}` from the current working directory. |
| 8 | Bonita version: **2025.x** (current) or **7.x** (legacy)? | Affects deployment URLs. Default to 2025.x and confirm. |
| 9 | Do they want a **component library** (AntD, Element Plus, ng-zorro, ...)? | Adds 200-300 KB to the bundle. For minimal Bonita pages, plain CSS is often enough. |
| 10 | Should the page be **full-screen** (Layout Without Menu) or **inside Bonita's chrome** (default layout)? | Full-screen is ~99% of the time. Default to "Layout Without Menu" and confirm. |
| 11 | Bonita port — **default 8080**, or different? | Default `localhost:8080` works for most installs (Studio, Tomcat bundle, Docker). Some Subscription deployments use other ports (e.g. `:29106`). If the user knows their port and it's NOT 8080, set the proxy target accordingly in `vite.config.ts` (Vite frameworks) or `proxy.conf.json` (Angular). |

### What you SHOULD NOT ask

- Don't ask about CSRF / hash routing / page.properties format. Those are universal rules — apply them automatically.
- Don't ask about how to compile or package. The toolkit's CLI handles it.

### Port detail — extending question 11

When the user mentions a non-default Bonita port (anywhere — error logs, URLs they paste, deployment notes), make sure to set it BEFORE the user starts dev mode. The proxy target isn't autodetected; if it's wrong, every API call returns 502 in dev (in production the SPA is on Bonita's own origin so the port doesn't matter for the deployed page).

For a Vite-based framework (React/Vue/Svelte/Solid/Qwik):
```ts
// vite.config.ts
server: {
  proxy: {
    '/bonita': { target: 'http://localhost:8080', changeOrigin: true, secure: false },
    //                                ^^^^ ← change here
  },
},
```

For Angular:
```json
// proxy.conf.json
{ "/bonita": { "target": "http://localhost:8080", ... } }
//                                ^^^^ ← change here
```

### What to do with the answers

Once you have answers to 1-5, you can:
- For an EXISTING SPA where you trust it conforms (or want a single command): run **`bonita-page prepare`** — it chains `check → wrap → npm install → npm run dist` and aborts at the first failed stage with a clear reason. Inside MCP this is the `prepare_custom_page` tool.
- Granular control: use the **`bonita-page`** CLI (`scripts/cli.js`) → either `scaffold` (new) or `wrap` (existing)
- OR if running inside an MCP-enabled agent, call `scaffold_custom_page` or `wrap_existing_app`

All paths use the same code under the hood. See [`../../docs/CLI.md`](../../docs/CLI.md) for the CLI reference.

## Architecture (the only one that works in production)

```
Production:
  Browser ──> Bonita Tomcat ──> Custom Page ZIP ──> SPA static files
  Same origin. No proxy. No nginx. No frontend server.

Development:
  Vite/ng serve dev server (localhost:5173 / :4200) ──proxy /bonita──> Bonita (localhost:8080)
```

The SPA is compiled to static files, packaged into a ZIP with a `page.properties` descriptor, uploaded via Bonita Admin and served from Bonita's own Tomcat. Because the app and Bonita share the same origin, **no CORS issues**, and authentication uses the existing Bonita session cookies.

## The seven non-negotiable rules

These rules apply equally to React, Vue and Angular. Breaking any of them causes deployment to fail.

### 1. Build with relative base paths

The custom page is served from a deep nested URL like `/bonita/portal/resource/page/{profile}/{pageName}/content/`. Absolute asset paths (`/assets/index.js`) return 404 because they resolve to `/assets/index.js` instead of inside the page directory.

| Framework | Where to set | Value |
|-----------|-------------|-------|
| React/Vue (Vite) | `vite.config.ts` → `base` | `'./'` (or `command === 'build' ? './' : '/'`) |
| Angular | `angular.json` → `architect.build.options.baseHref` | `'./'` |

### 2. Hash routing only, never browser/HTML5 routing

Bonita's Tomcat does not rewrite unknown URLs to `index.html`. A page refresh on `/my-route` returns 404 because Bonita doesn't know the route exists. Hash routes (`#/my-route`) live entirely in the browser and survive refreshes.

| Framework | API |
|-----------|-----|
| React Router | `createHashRouter([...])` |
| vue-router | `createRouter({ history: createWebHashHistory() })` |
| Angular Router | `{ provide: LocationStrategy, useClass: HashLocationStrategy }` |

### 3. API calls under `/bonita/API/...` — relative paths

In production the SPA is on the same origin as Bonita, so `/bonita/API/system/session/unusedId` resolves naturally. In dev, the dev server proxies `/bonita` to `http://localhost:8080`. A single base constant covers both:

```ts
const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';
```

Hard-coding `http://localhost:8080` breaks production. Hard-coding the production URL breaks dev. Always relative.

### 4. Always send credentials with API calls

Bonita uses the `JSESSIONID` cookie for session and `X-Bonita-API-Token` cookie for CSRF. Both are sent automatically only if `credentials: 'include'` is set on every `fetch` (or equivalent on the framework's HTTP client).

```ts
fetch(url, { credentials: 'include', ... })
```

Forgetting this causes 401 on every request, even though the user is logged in.

### 5. CSRF token: read from cookie, send as header

Bonita sets `X-Bonita-API-Token=<value>` as a cookie at login. **Every mutating request** (POST, PUT, DELETE) must echo the same value as the `X-Bonita-API-Token` HTTP header. GET requests don't strictly need it but sending it always is harmless and simpler.

See `references/auth-csrf.md` for the cookie-reading utility and login flow.

### 6. ZIP layout — exact structure required by Bonita

```
page-{name}.zip
├── page.properties             ← MUST be at ZIP root
└── resources/                  ← MUST be the wrapper directory name
    ├── index.html
    └── assets/
        ├── index-{hash}.js
        └── index-{hash}.css
```

`page.properties` must be at the ZIP root. The build output goes under `resources/`. Wrapping everything inside an extra parent directory is the most common mistake — Bonita silently uploads but can't find `index.html`.

See `references/zip-packaging.md` for the universal packaging script.

### 7. Restrictive Content-Security-Policy (with two important nuances)

Bonita Portal embeds the page in an iframe. Declare a strict CSP via `<meta>`:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob:; connect-src 'self';
  frame-src 'self' blob:;
  base-uri 'self'; form-action 'self'" />
```

Two things you'd think to add but **shouldn't**:

- **`frame-ancestors 'none'`** — browsers ignore `frame-ancestors` when delivered via `<meta>` and emit a console warning. Only the HTTP response header is honoured. Bonita Tomcat sets the response header itself, so omit this directive from the meta tag entirely.
- **Locked-down `script-src 'self'` for Angular** — Angular's runtime registers some click handlers as inline DOM attributes that the browser treats as inline scripts. With strict `script-src 'self'`, every click is blocked: *"Executing inline event handler violates Content Security Policy directive 'script-src 'self''"*. **For Angular custom pages, use `script-src 'self' 'unsafe-inline'`**. React, Vue, Svelte, Solid and Qwik don't need this — they use `addEventListener` exclusively.

`'unsafe-inline'` for `style-src` is needed by every component library that injects styles dynamically (Ant Design, Element Plus, ng-zorro, Element Plus, etc.). Adjust `font-src`/`img-src` if you load from external CDNs.

## What this skill does NOT cover (see framework skills)

- Project scaffolding commands (`npm create vite`, `ng new`, etc.)
- Component library wiring (Ant Design, Element Plus, ng-zorro, PrimeNG)
- State management (Zustand, Pinia, Angular signals/services)
- Build configuration files (vite.config.ts, angular.json)

## Bonita version differences (important)

Deployment URLs and admin UIs have changed across major Bonita versions. The skill assumes 2025.x as the current default.

| | Bonita 7.x / earlier | Bonita 2024.x / 2025.x (current) |
|---|---|---|
| Admin UI | `/bonita/portal/admin` | Removed — split between two Living Applications |
| Pages list | Portal → Resources → Pages | `/bonita/apps/superAdminAppBonita/resource-list/` (or `adminAppEEBonita/admin-resource-list/`) |
| Applications list | Portal → Applications | `/bonita/apps/superAdminAppBonita/application-list/` |
| Editions | Community + Subscription | Subscription only (Community retired in 2024) |
| BPM Portal (user portal) | `/bonita/portal/homepage` | Removed entirely |
| API surface | unchanged | unchanged |

For 2025.x SPAs that should fill the entire viewport, **always pick the built-in `Layout Without Menu`** when creating the Application (`application-list/` → +Create → Layout dropdown). Otherwise the default layout wraps your SPA with a Bonita header and side menu.

A standalone 2025.x deployment guide with screenshots-style step-by-step lives at [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).

## Bonita 2025.x API quirks

- **`o=` (ordering) is parsed strictly**. Repeat `o=` per criterion, never comma-separate:
  - ✅ `o=priority DESC&o=dueDate ASC`
  - ❌ `o=priority DESC,dueDate ASC` → HTTP 500
  Older Bonita versions tolerated commas; the new parser does not.
- **Search descriptors ≠ response field names**. The names accepted by `o=` and `f=` are search descriptors registered server-side, NOT the property names that appear in the JSON response. A query like `/bpm/process?o=lastUpdateDate+DESC` returns HTTP 500 with `Can't find search descriptor corresponding to lastUpdateDate` even though `lastUpdateDate` IS in the response. **The defensive default is to omit `o=`/`f=`/`d=` entirely** and sort/filter client-side after fetching a generous batch (≤100). This is what the BPM dashboard examples in this toolkit do — see `examples/*-directory-bonita/src/api/bpm.ts`.
- **CSP `frame-ancestors` doesn't work from `<meta>`**. Browsers only honour that directive when delivered via the HTTP `Content-Security-Policy` response header — not from `<meta http-equiv="Content-Security-Policy">`. They emit a console warning if you try. Bonita's Tomcat sets the response header itself, so omit `frame-ancestors` from the page's `<meta>` CSP. Other directives (`script-src`, `style-src`, `connect-src`, etc.) DO work from `<meta>`.

## References

- [`references/architecture.md`](references/architecture.md) — Detailed architecture with diagrams and request lifecycle
- [`references/bonita-apis.md`](references/bonita-apis.md) — Catalog of Bonita REST API endpoints used by typical SPAs
- [`references/auth-csrf.md`](references/auth-csrf.md) — Authentication, session probe, CSRF token handling, logout
- [`references/page-properties.md`](references/page-properties.md) — Format of `page.properties` and naming rules
- [`references/zip-packaging.md`](references/zip-packaging.md) — Universal ZIP packaging script (works for any framework)
- [`references/deployment.md`](references/deployment.md) — Step-by-step deployment (with separate sections for 7.x and 2025.x)

## How to use this skill

When a framework-specific skill is activated (e.g. `bonita-react-app`), it should:

1. Apply the seven rules above to the framework's idioms
2. Reference this skill's documents instead of duplicating their content
3. Only describe what is specific to that framework: scaffolding, build config, routing API, HTTP client/interceptor, state library
