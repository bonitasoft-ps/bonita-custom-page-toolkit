# React Task Viewer — Bonita custom page example

A working React + Vite + AntD application packaged as a Bonita custom page. It signs in, lists the current user's pending Bonita human tasks, and signs out.

## Prerequisites

- Node.js 20+
- A running Bonita instance on `http://localhost:8080` (Studio, Tomcat bundle, or Docker)
- Bonita admin credentials (default: `install` / `install`)

## Quick start

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173, proxies /bonita → :8080
```

Open `http://localhost:5173`. If you're already logged into Bonita Portal in another tab, the session probe picks it up automatically. Otherwise, the login page appears.

## Build the Bonita custom page ZIP

```bash
npm run build:bonita
```

Produces `dist/page-reactTaskViewer.zip` with the structure Bonita expects:

```
page-reactTaskViewer.zip
├── page.properties
└── resources/
    ├── index.html
    └── assets/
        ├── index-{hash}.js
        └── index-{hash}.css
```

## Deploy

See [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) for the full deployment process. Quick version:

1. Bonita Portal → **Resources** → **Add** → upload `dist/page-reactTaskViewer.zip`
2. **Applications** → create or open an app → **Pages** tab → add `React Task Viewer`
3. Open `http://localhost:8080/bonita/apps/{appToken}/`

## Project structure

```
react-task-viewer/
├── src/
│   ├── api/
│   │   ├── client.ts       — fetch wrapper with CSRF + session-expired handler
│   │   ├── auth.ts         — login / getSession / logout
│   │   └── tasks.ts        — getMyPendingTasks
│   ├── pages/
│   │   ├── Layout.tsx      — header with user name + logout
│   │   ├── LoginPage.tsx   — login form
│   │   ├── TasksPage.tsx   — table of pending tasks
│   │   └── ProtectedRoute.tsx
│   ├── stores/
│   │   └── authStore.ts    — Zustand auth state
│   ├── App.tsx             — session probe + router
│   ├── main.tsx
│   └── router.tsx          — createHashRouter
├── scripts/
│   └── package-bonita.js   — ZIP packaging
├── page.properties
├── vite.config.ts
└── package.json
```

## What it demonstrates

- **Session restoration**: when running inside the Bonita Portal iframe, the user is already logged in; the app probes `/API/system/session/unusedId` and skips the login form
- **CSRF token handling**: `X-Bonita-API-Token` cookie read and echoed as a header on every API call
- **Hash routing**: `createHashRouter` for refresh-safe URLs inside iframes
- **Same-origin API calls**: relative `/bonita/API/...` paths work in dev (proxy) and prod (no proxy needed)
- **AntD theme integration**: customizable primary color via `ConfigProvider`

## Customising

To rename the page (e.g., to `myCompanyTasks`):
1. Edit `page.properties` → `name=custompage_myCompanyTasks`
2. Edit `scripts/package-bonita.js` → change `OUTPUT_FILE`
3. Edit `package.json` → change `name`
4. Re-build with `npm run build:bonita`

To add a new page, add a route in `src/router.tsx` and a corresponding component under `src/pages/`. To call new APIs, create a module under `src/api/` using the `apiRequest` wrapper.

For more on the architecture and patterns used here, see the skill at [`../../skills/bonita-react-app/SKILL.md`](../../skills/bonita-react-app/SKILL.md).
