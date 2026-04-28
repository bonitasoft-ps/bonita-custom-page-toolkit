# Vue Task Viewer — Bonita custom page example

A working Vue 3 + Vite + Element Plus application packaged as a Bonita custom page. It signs in, lists the current user's pending Bonita human tasks, and signs out.

## Prerequisites

- Node.js 20+
- A running Bonita instance on `http://localhost:8080` (Studio, Tomcat bundle, or Docker)
- Bonita admin credentials (default: `install` / `install`)

## Quick start

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173, proxies /bonita → :8080
```

Open `http://localhost:5173`. If you're already logged into Bonita Portal in another tab, the session probe picks it up automatically. Otherwise, the login form appears.

## Build the Bonita custom page ZIP

```bash
npm run build:bonita
```

Produces `dist/page-vueTaskViewer.zip`:

```
page-vueTaskViewer.zip
├── page.properties
└── resources/
    ├── index.html
    └── assets/
        ├── index-{hash}.js
        └── index-{hash}.css
```

## Deploy

See [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) for full instructions. Quick version:

1. Bonita Portal → **Resources** → **Add** → upload `dist/page-vueTaskViewer.zip`
2. **Applications** → create or open an app → **Pages** tab → add `Vue Task Viewer`
3. Open `http://localhost:8080/bonita/apps/{appToken}/`

## Project structure

```
vue-task-viewer/
├── src/
│   ├── api/
│   │   ├── client.ts       — fetch wrapper with CSRF + session-expired handler
│   │   ├── auth.ts         — login / getSession / logout
│   │   └── tasks.ts        — getMyPendingTasks
│   ├── pages/
│   │   ├── Layout.vue      — header with user name + logout
│   │   ├── LoginPage.vue   — login form
│   │   └── TasksPage.vue   — table of pending tasks
│   ├── stores/
│   │   └── auth.ts         — Pinia auth store (setup style)
│   ├── router/
│   │   └── index.ts        — createWebHashHistory + auth guard
│   ├── App.vue             — RouterView + onMounted session probe
│   └── main.ts             — Vue plugin wiring
├── scripts/
│   └── package-bonita.js
├── page.properties
├── vite.config.ts
└── package.json
```

## What it demonstrates

- **Pinia setup-store style** for auth state
- **vue-router with createWebHashHistory** — hash routing required for iframe deployment
- **CSRF token handling**: `X-Bonita-API-Token` cookie read and echoed as a header
- **Session probe** in `App.vue onMounted` — auto-restores session when running inside Portal iframe
- **Element Plus** with custom theme

## Customising

To rename the page (e.g., to `myCompanyTasks`):
1. Edit `page.properties` → `name=custompage_myCompanyTasks`
2. Edit `scripts/package-bonita.js` → change `OUTPUT_FILE`
3. Edit `package.json` → change `name`
4. Re-build with `npm run build:bonita`

To add a new page, add a route in `src/router/index.ts` (lazy-loaded) and a corresponding `.vue` under `src/pages/`. To call new APIs, create a module under `src/api/` using `apiRequest` / `apiRequestWithCount`.

For more on architecture and patterns, see [`../../skills/bonita-vue-app/SKILL.md`](../../skills/bonita-vue-app/SKILL.md).
