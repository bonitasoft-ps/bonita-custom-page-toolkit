# Routing Template — Angular Router with HashLocationStrategy

## Why HashLocationStrategy

Bonita's Tomcat doesn't rewrite unknown URLs to `index.html`. The default Angular router uses `PathLocationStrategy` (HTML5 pushState), which generates URLs like `/tasks/123`. Refreshing such a URL hits Tomcat looking for a literal `tasks/123` resource → 404.

`HashLocationStrategy` puts the route after `#` (`/#/tasks/123`). Tomcat only sees `index.html` (the part before `#`), so refreshes always work.

## src/app/app.config.ts

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

`withHashLocation()` is the Angular 17+ way and equivalent to providing `HashLocationStrategy` manually. Either works; `withHashLocation()` is shorter.

If you prefer the explicit form:

```ts
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
// ...
providers: [
  provideRouter(routes),
  { provide: LocationStrategy, useClass: HashLocationStrategy },
  // ...
]
```

## src/app/app.routes.ts

```ts
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then(m => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./components/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home.page').then(m => m.HomePage),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks.page').then(m => m.TasksPage),
      },
      {
        path: 'tasks/:id',
        loadComponent: () => import('./pages/task-detail.page').then(m => m.TaskDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

## src/app/components/app-layout.component.ts

```ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <h2>Bonita App</h2>
        <nav>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/tasks" routerLinkActive="active">Tasks</a>
        </nav>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }
    .sidebar { background: #722ed1; color: white; padding: 24px; }
    .sidebar a { display: block; padding: 8px 12px; color: rgba(255,255,255,0.8); text-decoration: none; border-radius: 4px; }
    .sidebar a:hover, .sidebar a.active { background: rgba(255,255,255,0.1); color: white; }
    .content { padding: 24px; }
  `],
})
export class AppLayoutComponent {}
```

## Programmatic navigation

```ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export class SomeComponent {
  private router = inject(Router);

  goToTasks() {
    this.router.navigate(['/tasks']);
  }

  goToTask(id: string) {
    this.router.navigate(['/tasks', id]);
  }

  goWithQuery() {
    this.router.navigate(['/tasks'], { queryParams: { state: 'pending' } });
  }
}
```

## Reading params

```ts
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export class TaskDetailPage {
  private route = inject(ActivatedRoute);

  // Static read (snapshot — for a single value at navigation time)
  taskIdSnapshot = this.route.snapshot.paramMap.get('id');

  // Reactive read (signal — updates on param change)
  taskId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id') ?? ''))
  );
}
```

## Linking in templates

```html
<a [routerLink]="['/tasks', task.id]">View task</a>

<a routerLink="/tasks" [queryParams]="{ state: 'pending' }">Pending tasks</a>

<a [routerLink]="'/tasks'" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
  Tasks
</a>
```

`routerLink` produces `<a href="#/tasks">` under HashLocationStrategy — refresh-safe inside Bonita.

## Lazy loading explained

Each `loadComponent: () => import('...')` produces a separate JS chunk. Angular CLI splits them automatically. The user only downloads the chunk for the page they navigate to.

For the home page (always visited first), eager-loading is sometimes faster:

```ts
import { HomePage } from './pages/home.page';

{ path: '', component: HomePage }   // No loadComponent — bundled in main chunk
```

Tradeoff: larger initial bundle, but no extra HTTP round-trip on home navigation.

## Edge case — initial hash

When the user lands on `/bonita/apps/myApp/#/tasks/123`:
1. Tomcat serves `index.html`
2. Angular bootstraps, router reads `window.location.hash` → `#/tasks/123`
3. `auth.guard` runs, `loadSession()` resolves
4. The matching route component is loaded and rendered

If the parent URL has the hash but the iframe doesn't (rare), copy it before bootstrap in `main.ts`:

```ts
try {
  if (window.parent && window.parent !== window) {
    const parentHash = window.parent.location.hash;
    if (parentHash && !window.location.hash) {
      window.location.hash = parentHash;
    }
  }
} catch { /* cross-origin */ }
```

## Pitfalls

| Symptom | Cause |
|---------|-------|
| Hard refresh shows blank page | `HashLocationStrategy` not provided |
| Router resolves `/tasks` but content doesn't render | Forgot `<router-outlet />` in the layout |
| `Cannot match any routes` warning | Path mismatch — paths are case-sensitive, match exactly |
| Lazy components fail to load | Build chunk missing — check `dist/{app}/browser/` for `*.js` chunks |
| `routerLink` works but back button does nothing | Browser history not populated — confirm `withHashLocation()` is wired |
