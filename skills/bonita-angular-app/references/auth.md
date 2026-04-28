# Auth Template — Angular + Signals

## src/app/api/auth.service.ts

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

export interface BonitaSession {
  user_id: string;
  user_name: string;
  session_id: string;
  is_technical_user: boolean;
  conf: string[];
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  login(username: string, password: string): Promise<void> {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    body.set('redirect', 'false');

    return firstValueFrom(
      this.http.post<void>('/bonita/loginservice', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        responseType: 'text' as 'json',
      })
    ).then(() => undefined);
  }

  getSession(): Observable<BonitaSession> {
    return this.http.get<BonitaSession>('/bonita/API/system/session/unusedId');
  }

  logout(): Promise<void> {
    return firstValueFrom(
      this.http.get('/bonita/logoutservice', { responseType: 'text' })
    ).then(() => undefined);
  }
}
```

Note: the interceptor takes care of `withCredentials` and the CSRF header — this service stays clean.

## src/app/stores/auth.store.ts

Signal-based store. Composable, fine-grained reactivity, no RxJS overhead for simple state.

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, BonitaSession } from '@app/api/auth.service';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = signal<AuthUser | null>(null);
  isLoading = signal(true);
  isAuthenticated = computed(() => this.user() !== null);

  async loadSession(): Promise<void> {
    this.isLoading.set(true);
    try {
      const s = await firstValueFrom(this.auth.getSession());
      this.user.set(this.toUser(s));
    } catch {
      this.user.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  setUser(s: BonitaSession): void {
    this.user.set(this.toUser(s));
  }

  async logoutAndRedirect(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      this.user.set(null);
      this.router.navigate(['/login']);
    }
  }

  /** Called by the API interceptor on 401/403 */
  handleSessionExpired(): void {
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private toUser(s: BonitaSession): AuthUser {
    return {
      userId: s.user_id,
      userName: s.user_name,
      displayName: s.user_name,
      isTechnicalUser: s.is_technical_user,
    };
  }
}
```

## ⚠️ Critical: probe the session BEFORE the router boots — `APP_INITIALIZER`

If you call `loadSession()` from `app.component.ts`'s `ngOnInit`, the auth guard runs **before** the probe resolves: `isLoading()` is still true, the guard sees `isAuthenticated() === false`, and bounces every user to `/login` — even when they ARE logged into Bonita and the app is loaded inside the Portal iframe. This is the most common Angular-on-Bonita bug.

The fix: run `loadSession()` as an `APP_INITIALIZER` so Angular waits for the promise to resolve **before** mounting the router. By the time the guard executes, the session state is final.

### src/app/app.config.ts

```ts
import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthStore } from './stores/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Probe the Bonita session BEFORE the router bootstraps.
    // Guarantees that when the auth guard runs, isAuthenticated() reflects
    // the real session state — no false /login redirect on initial load.
    {
      provide: APP_INITIALIZER,
      useFactory: (store: AuthStore) => () => store.loadSession(),
      deps: [AuthStore],
      multi: true,
    },
  ],
};
```

`APP_INITIALIZER` factories return a `Promise` (or Observable). Angular waits for the promise to resolve before bootstrapping the root component. Errors do NOT block bootstrap — `loadSession()` swallows 401/403 and sets `user = null`, which is the desired "no session" state.

### src/app/app.component.ts — keep it minimal

```ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { setSessionExpiredHandler } from './api/client';
import { AuthStore } from './stores/auth.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private store = inject(AuthStore);

  ngOnInit() {
    // Session probe already ran in APP_INITIALIZER — only wire up
    // the runtime session-expired handler here (for 401/403 mid-session).
    setSessionExpiredHandler(() => this.store.handleSessionExpired());
  }
}
```

### src/app/guards/auth.guard.ts — simplified

Because the session is resolved by the time the guard runs, the guard becomes a one-liner check:

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@app/stores/auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  // Auth state is final by the time this guard runs (APP_INITIALIZER did the probe).
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  return true;
};
```

**Do NOT** check `auth.isLoading()` here — with `APP_INITIALIZER` it's always false on first run. If you keep the check, you risk false `/login` redirects when something else triggers `isLoading()` (e.g. session refresh after logout).

## src/app/pages/login.page.ts

```ts
import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@app/api/auth.service';
import { AuthStore } from '@app/stores/auth.store';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrapper">
      <form (submit)="onSubmit($event)" class="login-form">
        <h1>Sign in</h1>
        <input type="text" [(ngModel)]="username" name="username" placeholder="Username" required />
        <input type="password" [(ngModel)]="password" name="password" placeholder="Password" required />
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login-wrapper { display:flex; justify-content:center; align-items:center; min-height:100dvh; background:#f3f3f1; }
    .login-form { width:320px; padding:32px; background:white; border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:12px; }
    input { padding:10px; border:1px solid #ddd; border-radius:4px; }
    button { padding:10px; background:#722ed1; color:white; border:none; border-radius:4px; cursor:pointer; }
    button:disabled { opacity:0.6; cursor:not-allowed; }
    .error { color:#c00; margin:0; }
  `],
})
export class LoginPage {
  private auth = inject(AuthService);
  private store = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.username, this.password);
      const s = await firstValueFrom(this.auth.getSession());
      this.store.setUser(s);
      const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
      this.router.navigateByUrl(redirect);
    } catch {
      this.error.set('Invalid credentials');
    } finally {
      this.loading.set(false);
    }
  }
}
```

## Wiring session-expired handler

In `app.component.ts`:

```ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { setSessionExpiredHandler } from './api/client';
import { AuthStore } from './stores/auth.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private store = inject(AuthStore);

  ngOnInit() {
    setSessionExpiredHandler(() => this.store.handleSessionExpired());
    this.store.loadSession();
  }
}
```

## Why signals (and not BehaviorSubject)

For UI state (user, isAuthenticated, isLoading), signals:
- Update synchronously
- Templates auto-track dependencies
- No `async` pipe needed (`{{ user()?.displayName }}`)
- `computed()` automatically derives — no manual `combineLatest`

For HTTP responses, keep `Observable<T>` from `HttpClient` and convert to a Promise/signal at the consumer level if needed.

## Why a separate AuthService and AuthStore

- **AuthService**: stateless wrapper around HTTP calls
- **AuthStore**: app-wide reactive state (user, loading, etc.)

Splitting them makes both easier to test. The store depends on the service; pages and guards depend only on the store.

If your app is tiny, collapse them into one — but as soon as you have multiple pages reading the user, the split pays off.
