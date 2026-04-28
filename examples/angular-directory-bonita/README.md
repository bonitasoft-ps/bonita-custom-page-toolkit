# Angular Task Viewer — Bonita custom page example

A working Angular 18 standalone application packaged as a Bonita custom page. It signs in, lists the current user's pending Bonita human tasks, and signs out.

## Prerequisites

- Node.js 20+
- A running Bonita instance on `http://localhost:8080` (Studio, Tomcat bundle, or Docker)
- Bonita admin credentials (default: `install` / `install`)

## Quick start

```bash
npm install
npm start            # ng serve on http://localhost:4200, proxies /bonita → :8080
```

Open `http://localhost:4200`. If you're already logged into Bonita Portal in another tab, the session probe picks it up automatically. Otherwise, the login form appears.

## Build the Bonita custom page ZIP

```bash
npm run build:bonita
```

Produces `dist/page-angularTaskViewer.zip`:

```
page-angularTaskViewer.zip
├── page.properties
└── resources/
    ├── index.html
    └── *.{js,css}
```

> Angular's build emits `dist/angular-task-viewer/browser/` (not just `dist/`). The packaging script reads from that path via `cross-env DIST_DIR=...`.

## Deploy

See [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) for full instructions. Quick version:

1. Bonita Portal → **Resources** → **Add** → upload `dist/page-angularTaskViewer.zip`
2. **Applications** → create or open an app → **Pages** tab → add `Angular Task Viewer`
3. Open `http://localhost:8080/bonita/apps/{appToken}/`

## Project structure

```
angular-task-viewer/
├── src/
│   └── app/
│       ├── api/
│       │   ├── client.ts             — CSRF cookie reader + session-expired hook
│       │   ├── auth.service.ts       — login / getSession / logout
│       │   └── tasks.service.ts      — getMyPendingTasks
│       ├── interceptors/
│       │   └── auth.interceptor.ts   — Injects CSRF + withCredentials
│       ├── guards/
│       │   └── auth.guard.ts         — Functional CanActivate guard
│       ├── pages/
│       │   ├── layout.component.ts   — Header + RouterOutlet
│       │   ├── login.page.ts         — Login form
│       │   └── tasks.page.ts         — Pending tasks table
│       ├── stores/
│       │   └── auth.store.ts         — Signal-based auth store
│       ├── app.component.ts          — Root + session probe
│       ├── app.config.ts             — provideRouter + provideHttpClient
│       └── app.routes.ts             — Lazy-loaded routes
├── scripts/
│   └── package-bonita.js
├── public/
│   └── favicon.svg
├── proxy.conf.json
├── angular.json                      — baseHref './' + proxy + production budgets
├── page.properties
└── package.json
```

## What it demonstrates

- **Standalone components** (no NgModule) — modern Angular structure
- **Signal-based store** with `computed()` for derived state
- **Functional HTTP interceptor** reading the CSRF cookie + setting `withCredentials`
- **Functional guard** with `CanActivateFn`
- **`withHashLocation()`** — hash routing required for iframe deployment
- **Lazy-loaded routes** — each page is a separate JS chunk

## Customising

To rename the page (e.g., to `myCompanyTasks`):
1. Edit `page.properties` → `name=custompage_myCompanyTasks`
2. Edit `scripts/package-bonita.js` → change `OUTPUT_FILE`
3. Edit `package.json` → change `name` and the `DIST_DIR` in `build:bonita`
4. Edit `angular.json` → change project name and `outputPath`
5. Re-build with `npm run build:bonita`

To add a new page, add a route in `src/app/app.routes.ts` (lazy-loaded) and a corresponding standalone component under `src/app/pages/`. To call new APIs, create a service under `src/app/api/` injecting `HttpClient` — the interceptor handles CSRF/credentials automatically.

For more on architecture and patterns, see [`../../skills/bonita-angular-app/SKILL.md`](../../skills/bonita-angular-app/SKILL.md).
