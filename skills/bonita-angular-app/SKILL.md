---
name: bonita-angular-app
description: Use when the user wants to create a new Angular application for Bonita, scaffold an Angular custom page, or set up an Angular standalone-components project served by Bonita's Tomcat. Covers Angular-specific scaffolding, angular.json baseHref, HashLocationStrategy, HTTP interceptor with CSRF, ng-zorro / Angular Material wiring, route guards. Delegates the framework-agnostic parts (architecture, ZIP layout, page.properties, Bonita APIs, CSRF, deployment) to the bonita-custom-page skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<new|scaffold|explain> [app-name]"
---

# Bonita Angular App — custom page skill

You are an expert in building Angular (standalone components, signals) applications deployed as Bonita custom pages.

**Read first**: the framework-agnostic foundations live in `../bonita-custom-page/SKILL.md` and its `references/` (architecture, Bonita APIs, auth/CSRF, page.properties, ZIP packaging, deployment). Don't restate them here — link to them.

This skill covers only what is **Angular-specific**.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Angular CLI (esbuild) | Standard for Angular. Output is hashed, tree-shaken. |
| Language | Angular 17+ + TypeScript + standalone components | Modern Angular. No NgModules required. |
| Components | ng-zorro-antd (or Angular Material / PrimeNG) | Mature, themeable, suits enterprise UIs |
| Router | Angular Router + `HashLocationStrategy` | Hash routing required for iframe deployment |
| State | Signals (or services with RxJS) | Native to Angular, fine-grained reactivity |
| HTTP | `HttpClient` + interceptor | Built-in. Interceptor injects CSRF token. |
| i18n | `@angular/localize` or ngx-translate | Pick based on whether you need build-time vs runtime translations |

## Activation flow

When this skill activates:

1. **Determine the action**: scaffold a new app, integrate Bonita auth into an existing app, or explain a pattern?
2. **Read the foundational skill**: `../bonita-custom-page/SKILL.md` for the rules every Bonita SPA must follow.
3. **Apply Angular idioms**: use the templates in `references/` for code samples.

## Scaffolding a new project

### Step 1 — initialize

```bash
ng new {app-name} --routing --style=css --ssr=false --standalone
cd {app-name}
ng add ng-zorro-antd          # optional UI library
npm install -D archiver cross-env
```

`--ssr=false` is critical — server-side rendering doesn't apply (Bonita serves static files, no Node runtime). Avoid the prompt asking about SSR.

### Step 2 — project structure

```
src/
├── app/
│   ├── api/
│   │   ├── client.ts            ← Token utilities (read cookie)
│   │   ├── auth.service.ts      ← login / getSession / logout
│   │   └── tasks.service.ts     ← Task domain calls
│   ├── interceptors/
│   │   └── auth.interceptor.ts  ← Inject X-Bonita-API-Token + withCredentials
│   ├── guards/
│   │   └── auth.guard.ts        ← CanActivate guard
│   ├── pages/
│   │   ├── login.page.ts
│   │   ├── home.page.ts
│   │   └── tasks.page.ts
│   ├── components/
│   │   ├── app-layout.component.ts
│   │   └── topbar.component.ts
│   ├── stores/
│   │   └── auth.store.ts        ← Signal-based store
│   ├── app.config.ts            ← provideRouter + provideHttpClient + LocationStrategy
│   ├── app.routes.ts            ← Routes definition
│   └── app.component.ts         ← Root component (RouterOutlet + onInit)
├── styles.css
├── index.html                   ← Includes CSP meta tag
└── main.ts                      ← bootstrapApplication
```

### Step 3 — apply the templates

- [`references/angular-config.md`](references/angular-config.md) — `angular.json` baseHref + dev proxy
- [`references/api-interceptor.md`](references/api-interceptor.md) — HTTP interceptor for CSRF + credentials
- [`references/auth.md`](references/auth.md) — Auth service + signal store + guard + login page
- [`references/routing.md`](references/routing.md) — `provideRouter` + `HashLocationStrategy`

For ZIP packaging and `page.properties`, use the universal templates from `../bonita-custom-page/references/zip-packaging.md` and `../bonita-custom-page/references/page-properties.md`.

### Step 4 — package.json scripts

```json
{
  "type": "module",
  "scripts": {
    "start": "ng serve",
    "build": "ng build --configuration=production",
    "build:bonita": "ng build --configuration=production && cross-env DIST_DIR=dist/{app-name}/browser node scripts/package-bonita.js"
  }
}
```

`cross-env` is needed on Windows to set the `DIST_DIR` env var portably.

## Angular-specific rules (in addition to the universal seven)

### A. `baseHref: './'` in `angular.json`, NOT in code

Edit `angular.json` → `projects.{app}.architect.build.options`:

```json
{
  "baseHref": "./",
  "outputPath": "dist/{app-name}"
}
```

Don't put `<base href="./">` in `index.html` and don't override at runtime — `angular.json` is the single source of truth.

### B. `HashLocationStrategy` provider in `app.config.ts`

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

URLs become `#/login`, `#/tasks/123`, etc. — the only mode that survives a refresh inside Bonita.

### C. `withCredentials: true` on EVERY HttpClient call

The interceptor sets it once for all requests:

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getCsrfTokenFromCookie();
  const updated = req.clone({
    setHeaders: token ? { 'X-Bonita-API-Token': token } : {},
    withCredentials: true,
  });
  return next(updated);
};
```

Forgetting `withCredentials` causes 401 on every request even though the user is logged in.

### D. Standalone components — no NgModule

Modern Angular (17+) uses `bootstrapApplication(AppComponent, appConfig)` directly. Keep `app.module.ts` out — it adds noise. Use `imports: [...]` arrays in components.

### E. `inject()` over constructor injection inside services/components

```ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  // ...
}
```

Cleaner than constructor params, works in functional `CanActivateFn` guards too.

### F. Probe the Bonita session as APP_INITIALIZER

This is **mandatory** in Angular — calling `loadSession()` from `AppComponent.ngOnInit` causes the auth guard to redirect to `/login` before the probe finishes, even when the user IS logged into Bonita. Wrap it as an `APP_INITIALIZER` so Angular waits before mounting the router:

```ts
// app.config.ts
import { APP_INITIALIZER } from '@angular/core';
import { AuthStore } from './stores/auth.store';

providers: [
  // ...
  {
    provide: APP_INITIALIZER,
    useFactory: (store: AuthStore) => () => store.loadSession(),
    deps: [AuthStore],
    multi: true,
  },
],
```

Then `app.component.ts` only wires the session-expired handler, and the guard is a one-line `isAuthenticated()` check (no `isLoading()` branch). Full pattern in [`references/auth.md`](references/auth.md).

### G. Signals for state, RxJS for streams

For local UI state and store fields, prefer signals:

```ts
@Injectable({ providedIn: 'root' })
export class AuthStore {
  user = signal<AuthUser | null>(null);
  isAuthenticated = computed(() => this.user() !== null);
  isLoading = signal(true);
}
```

For HTTP responses use `Observable<T>` or `firstValueFrom(...)` to convert to `Promise<T>`.

## Common patterns

### Adding a new API service

```ts
// src/app/api/tasks.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Task {
  id: string;
  name: string;
  caseId: string;
  state: string;
  priority: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);

  getMyTasks(userId: string, page = 0, size = 20): Observable<Task[]> {
    // Bonita 2025.x: repeat `o` per ordering criterion, NOT comma-separated (returns 500)
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    params.append('f', 'state=ready');
    params.append('f', `user_id=${userId}`);
    params.append('o', 'priority DESC');
    params.append('o', 'dueDate ASC');
    return this.http.get<Task[]>(`/bonita/API/bpm/humanTask?${params}`);
  }
}
```

### Functional route guard

```ts
// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { redirect: state.url } });
    return false;
  }
  return true;
};
```

### Wiring in routes

```ts
// src/app/app.routes.ts
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  {
    path: '',
    loadComponent: () => import('./components/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/home.page').then(m => m.HomePage) },
      { path: 'tasks', loadComponent: () => import('./pages/tasks.page').then(m => m.TasksPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

## Troubleshooting (Angular-specific)

| Symptom | Cause | Fix |
|---------|-------|-----|
| App always redirects to `/login`, even when the user IS logged into Bonita | `loadSession()` called from `AppComponent.ngOnInit`; guard runs before the probe finishes and sees `isAuthenticated() === false` | Move the probe to `APP_INITIALIZER` (rule F) so Angular awaits it before bootstrapping the router |
| Build emits `dist/<app>/browser/` and `dist/<app>/server/` | SSR enabled | Re-run `ng new` with `--ssr=false`, or remove the `server` config from angular.json |
| Routes 404 on refresh | Default `PathLocationStrategy` | Provide `HashLocationStrategy` in `app.config.ts` |
| 401 on every API call | Interceptor missing OR `withCredentials` missing | Apply the interceptor template |
| 403 on POST/PUT/DELETE | CSRF header not echoed | Interceptor reads cookie + sets `X-Bonita-API-Token` |
| `NullInjectorError: No provider for HttpClient` | `provideHttpClient` not in `appConfig.providers` | Add it |
| ng-zorro components unstyled | Missing theme import | `@import "ng-zorro-antd/ng-zorro-antd.css";` in styles.css |
| `Application bundles failed` with esbuild | Cyclic imports or wrong tsconfig | Check the bundle stats output |
| Hash present but route doesn't match | Wrong `path` in routes | Routes are case-sensitive — match exactly |
| HTTP 500 on `/API/bpm/humanTask` with multiple sort criteria | Bonita 2025.x rejects comma-separated `o=`. | Use `params.append('o', 'a DESC'); params.append('o', 'b ASC')` — never `o=a DESC,b ASC` |

For framework-agnostic issues (CORS, blank page in prod, ZIP layout, etc.) see `../bonita-custom-page/references/deployment.md`.

## Reference examples

- [`../../examples/angular-task-viewer/`](../../examples/angular-task-viewer/) — task list + login flow, generic 8080 default
- [`../../examples/angular-directory-bonita/`](../../examples/angular-directory-bonita/) — turnkey deploy to a custom Application (`appDirectoryBonitaAngular`); ships `build.sh` / `build.bat` (one command for install + ZIP + multilingual EN/FR/ES deploy docs)

## Deployment quick reference (Bonita 2025.x)

After `npm run build:bonita` or `./build.sh`, upload via the Bonita 2025.x admin UI:

1. **`/bonita/apps/superAdminAppBonita/resource-list/`** → +Add → upload the ZIP
2. **`/bonita/apps/superAdminAppBonita/application-list/`** → +Create application; pick **`Layout Without Menu`** so the SPA fills the viewport
3. **`/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}`** → Pages → +Add → token `home` (or whatever)
4. Open `http://{host}/bonita/apps/{appToken}/{pageToken}/?_l=en`

Full walkthrough including the Admin EE alternative path: [`../../DEPLOY_2025.md`](../../DEPLOY_2025.md).
