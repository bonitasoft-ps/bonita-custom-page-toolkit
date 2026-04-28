# HTTP Interceptor Template — Angular + Bonita

The interceptor sits between every `HttpClient` call and the network. It does three things:
1. Adds `withCredentials: true` (so session cookies are sent)
2. Reads the `X-Bonita-API-Token` cookie and echoes it as a header
3. Detects 401/403 and triggers a session-expired callback

## src/app/api/client.ts (helpers)

```ts
export function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export function notifySessionExpired() {
  onSessionExpired?.();
}
```

## src/app/interceptors/auth.interceptor.ts

```ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { getCsrfTokenFromCookie, notifySessionExpired } from '@app/api/client';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only inject the header for Bonita requests (not third-party APIs)
  if (!req.url.includes('/bonita/')) {
    return next(req);
  }

  const token = getCsrfTokenFromCookie();
  const setHeaders: Record<string, string> = {};
  if (token) setHeaders['X-Bonita-API-Token'] = token;

  const updated = req.clone({
    setHeaders,
    withCredentials: true,           // CRITICAL: sends JSESSIONID + CSRF cookies
  });

  return next(updated).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 || err.status === 403) {
        notifySessionExpired();
      }
      return throwError(() => err);
    })
  );
};
```

## Wiring in app.config.ts

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

`withInterceptors([...])` is the new functional API — preferred over `HTTP_INTERCEPTORS` class registration.

## Domain service example

The interceptor handles all the auth plumbing, so domain services stay clean:

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Task {
  id: string;
  name: string;
  caseId: string;
  state: string;
  priority: string;
  dueDate?: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);

  getMyTasks(userId: string, page = 0, size = 20): Observable<Task[]> {
    let params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    params.append('f', 'state=ready');
    params.append('f', `user_id=${userId}`);
    // Bonita 2025.x: one `o` per ordering criterion, NOT comma-separated (returns 500)
    params.append('o', 'priority DESC');
    params.append('o', 'dueDate ASC');
    return this.http.get<Task[]>(`/bonita/API/bpm/humanTask?${params}`);
  }

  executeTask(taskId: string, vars: Record<string, unknown> = {}): Observable<void> {
    return this.http.post<void>(`/bonita/API/bpm/userTask/${taskId}/execution`, vars);
  }
}
```

Note: no `withCredentials`, no manual headers — the interceptor handles it.

## Optional — read total count from `Content-Range`

Bonita returns the total count in `Content-Range`. To use it, pass `observe: 'response'`:

```ts
import { HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

getMyTasksWithTotal(userId: string, page = 0, size = 20) {
  // ... build params
  return this.http
    .get<Task[]>(`/bonita/API/bpm/humanTask?${params}`, { observe: 'response' })
    .pipe(
      map((res: HttpResponse<Task[]>) => {
        const range = res.headers.get('Content-Range');
        const total = range ? Number(range.split('/')[1]) : -1;
        return { data: res.body ?? [], total };
      })
    );
}
```

## Why functional interceptors

Functional interceptors (`HttpInterceptorFn`) are the modern Angular API:
- Can use `inject()` for services
- No NgModule registration
- Composable in arrays passed to `withInterceptors([...])`

The legacy class-based interceptor (`HttpInterceptor`) still works but doesn't compose as cleanly.

## Pitfalls

| Symptom | Cause |
|---------|-------|
| Infinite 401 loop | Session-expired handler navigates to login → login page makes API calls → still 401 → loop. Make sure login page does NOT call protected APIs. |
| Cookie set but not sent | Forgot `withCredentials` in the interceptor |
| 403 only on non-GET | Interceptor running but token missing — check `getCsrfTokenFromCookie()` returns the right string |
| Token in cookie but request fails | Cookie value not URL-decoded |
| Interceptor not running | Forgot `provideHttpClient(withInterceptors([authInterceptor]))` in app.config |
