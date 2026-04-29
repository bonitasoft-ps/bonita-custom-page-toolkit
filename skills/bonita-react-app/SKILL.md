---
name: bonita-react-app
description: Use when the user wants to create a new React application for Bonita, scaffold a React custom page, or set up a Vite + React + TypeScript project served by Bonita's Tomcat. Covers React-specific scaffolding, vite.config.ts, react-router HashRouter, Zustand auth store, AntD wiring, iframe URL sync hook. Delegates the framework-agnostic parts (architecture, ZIP layout, page.properties, Bonita APIs, CSRF, deployment) to the bonita-custom-page skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|explain> [app-name]"
---

# Bonita React App — custom page skill

You are an expert in building React + Vite + TypeScript applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/` (architecture, Bonita APIs, auth/CSRF, page.properties, ZIP packaging, deployment). Don't restate them here — link to them.

This skill covers only what is **React-specific**.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite | Fast HMR, native ESM, configurable proxy, hashed asset filenames |
| UI | React 19 + TypeScript | Modern, typed, component-based |
| Components | Ant Design 5 | Rich library, theme tokens, composes well in iframes |
| Router | react-router v7 + `createHashRouter` | Hash routing required for iframe deployment |
| State | Zustand | Tiny, no Redux boilerplate, works outside React components too |
| HTTP | `fetch` | Native — no extra dependency for the API client |

## Activation flow

When this skill activates:

1. **Determine the action**: scaffold a new app, wrap an existing one, or explain a pattern?
2. **Ask the questions in §"Questions to ask before generating"** — don't assume names, app tokens, or other params.
3. **Read the foundational skill**: `../bonita-custom-page/SKILL.md` for the rules every Bonita SPA must follow.
4. **Apply React idioms**: use the templates in `references/` for code samples.

## Questions to ask before generating

(See `../bonita-custom-page/SKILL.md` §"Questions to ask BEFORE doing anything" for the universal checklist.)

React-specific add-ons:

| # | Question | Notes |
|---|----------|-------|
| R1 | Component library: **Ant Design**, **Material UI**, **Chakra**, or **none**? | The user's existing codebase usually decides this. If new, AntD is a safe default for Bonita PS-style apps. |
| R2 | State management: **Zustand**, **Redux Toolkit**, or **just useState/useContext**? | Default Zustand — small footprint, no boilerplate. Switch only when you have a strong reason. |
| R3 | Tests? Vitest, Jest, or none? | Tooling — defaults to none for a custom page; add later if it grows. |

## Scaffolding a new project

### Step 1 — initialize

```bash
npm create vite@latest {app-name} -- --template react-ts
cd {app-name}
npm install antd @ant-design/icons react-router-dom zustand
npm install -D archiver @types/node
```

### Step 2 — project structure

```
src/
├── api/
│   ├── client.ts          ← fetch wrapper with CSRF + session-expired hook
│   └── auth.ts            ← login / getSession / logout
├── components/
│   ├── Layout.tsx         ← AppLayout (sidebar, topbar, content)
│   ├── ProtectedRoute.tsx ← Auth guard
│   └── ErrorBoundary.tsx
├── hooks/
│   └── useParentFrameSync.ts  ← Sync iframe hash → parent hash for bookmarks
├── stores/
│   └── authStore.ts       ← Zustand auth state
├── pages/                 ← Route components
│   ├── LoginPage.tsx
│   └── HomePage.tsx
├── styles/
│   └── global.css
├── App.tsx                ← ConfigProvider + RouterProvider + session check
├── main.tsx               ← createRoot + StrictMode
└── router.tsx             ← createHashRouter
```

### Step 3 — apply the templates

Each file below has a copy-pastable template:

- [`references/vite-config.md`](references/vite-config.md) — Vite config with proxy + relative base + path aliases
- [`references/api-client.md`](references/api-client.md) — Centralized fetch wrapper with CSRF
- [`references/auth.md`](references/auth.md) — Login / session probe / Zustand store / ProtectedRoute
- [`references/router.md`](references/router.md) — createHashRouter setup
- [`references/iframe-sync.md`](references/iframe-sync.md) — Hook to sync iframe → parent hash (bookmarkable URLs)

For ZIP packaging and `page.properties`, use the universal templates from `../bonita-custom-page/references/zip-packaging.md` and `../bonita-custom-page/references/page-properties.md`.

### Step 4 — package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:bonita": "vite build && node scripts/package-bonita.js",
    "preview": "vite preview"
  }
}
```

### Step 5 — `.env`

```env
VITE_BONITA_URL=/bonita
```

Single value for both dev and prod (the Vite proxy handles dev redirection).

## React-specific rules (in addition to the universal seven)

### A. `createHashRouter`, not `createBrowserRouter`

```ts
import { createHashRouter } from 'react-router-dom';
export const router = createHashRouter([...]);
```

Browser router uses `pushState` which generates URLs Bonita's Tomcat doesn't know how to serve.

### B. `RouterProvider` inside `ConfigProvider`

```tsx
<ConfigProvider theme={{ token: { colorPrimary: '#722ED1' } }}>
  <RouterProvider router={router} />
</ConfigProvider>
```

AntD's `ConfigProvider` must wrap everything that uses AntD components, including pages rendered by the router.

### C. Session check before first render

The user is already logged in when the app loads inside the Portal iframe. The login page is only for dev/standalone access. Run the session probe in `App.tsx` `useEffect`, set `isLoading=true` until it resolves, and let `ProtectedRoute` defer rendering until ready.

See `references/auth.md` for the pattern.

### D. Module-level token state in `api/client.ts`

The CSRF token must be readable from non-React code (interceptors, error handlers). Keep it in a module-level `let apiToken` AND mirror it to the Zustand store for components.

```ts
let apiToken: string | null = null;
export const setApiToken = (t: string) => { apiToken = t; };
export const getApiToken = () => apiToken;
```

### E. Iframe parent-frame hash sync (optional but useful)

When the SPA navigates `#/admin/users`, the iframe URL updates but the parent (Bonita Portal) URL doesn't. Bookmarks captured at the parent level wouldn't restore the route. The `useParentFrameSync` hook fixes this.

See `references/iframe-sync.md`.

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
  // Repeat `f` and `o` for multiple filters / ordering criteria — Bonita 2025.x
  // returns HTTP 500 if `o` is comma-separated.
  params.append('f', 'state=ready');
  params.append('f', `user_id=${userId}`);
  params.append('o', 'priority DESC');
  params.append('o', 'dueDate ASC');
  return apiRequest<Task[]>(`/bpm/humanTask?${params}`);
}
```

### Adding a protected route

```tsx
// In router.tsx, under the ProtectedRoute parent:
{ path: 'reports', element: <ReportsPage /> }
```

### Admin-only routes

```tsx
{
  path: 'admin',
  element: <ProtectedRoute requireAdmin><Outlet /></ProtectedRoute>,
  children: [
    { path: 'users', element: <UsersPage /> },
  ],
}
```

## Troubleshooting (React-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| "useNavigate must be used within Router" | Component rendered outside `<RouterProvider>` | Move it inside the router tree |
| Blank page, no errors | Build failed silently — check `npm run build` output | Re-run with `tsc -b` separately |
| AntD components unstyled | Missing `import 'antd/dist/reset.css'` or `ConfigProvider` | Import reset.css in `main.tsx`, wrap App in `ConfigProvider` |
| Hooks rules violation | Calling hooks conditionally | React linter usually catches this — run `npm run lint` |
| Hot reload broken | `base: './'` in dev mode | Use `command === 'build' ? './' : '/'` |
| Form data not posting | Sending JSON instead of urlencoded for `/loginservice` | Login uses `application/x-www-form-urlencoded` |

For framework-agnostic issues (CORS, 401 on every request, blank page in prod, etc.) see `../bonita-custom-page/references/deployment.md`.

## Reference examples

- [`../../examples/react-task-viewer/`](../../examples/react-task-viewer/) — task list + login flow, generic 8080 default
- [`../../examples/react-directory-bonita/`](../../examples/react-directory-bonita/) — turnkey deploy to a custom Application (`appDirectoryBonitaReact`); ships `build.sh` / `build.bat` (one command for install + ZIP + multilingual EN/FR/ES deploy docs)

## Deployment quick reference (Bonita 2025.x)

After `npm run build:bonita` or `./build.sh`, the resulting ZIP is uploaded via the Bonita 2025.x admin UI:

1. **`/bonita/apps/superAdminAppBonita/resource-list/`** → +Add → upload the ZIP
2. **`/bonita/apps/superAdminAppBonita/application-list/`** → +Create application; pick **`Layout Without Menu`** so the SPA fills the viewport
3. **`/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}`** → Pages → +Add → token `home` (or whatever)
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough including the Admin EE alternative path: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
