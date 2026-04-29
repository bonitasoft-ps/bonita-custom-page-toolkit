# API Client Template — Svelte + Bonita

Same fetch-based wrapper used in React/Vue/Angular examples — Svelte adds nothing framework-specific here. Lives in a plain `.ts` module (NOT `.svelte.ts`, since this is just functions, no reactive state).

## src/lib/api/client.ts

```ts
const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getCsrfToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('X-Bonita-API-Token', token);

  const res = await fetch(`${BASE}/API${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    onSessionExpired?.();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
}

export async function apiRequestWithCount<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; total: number }> {
  // ... same shape, also reads Content-Range header ...
}
```

## src/lib/api/auth.ts

```ts
import { apiRequest } from './client';

const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';

export interface BonitaSession {
  user_id: string;
  user_name: string;
  session_id: string;
  is_technical_user: boolean;
  conf: string[];
  token: string;
}

export async function login(username: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username, password, redirect: 'false' });
  const res = await fetch(`${BASE}/loginservice`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('Login failed');
}

export const getSession = () => apiRequest<BonitaSession>('/system/session/unusedId');

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logoutservice`, { method: 'GET', credentials: 'include' });
}
```

## Domain example — tasks.ts

```ts
import { apiRequestWithCount } from './client';

export interface BonitaTask {
  id: string; name: string; displayName?: string;
  caseId: string; state: string; priority: string; dueDate?: string;
}

export async function getMyPendingTasks(userId: string, page = 0, size = 20) {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('f', 'state=ready');
  params.append('f', `user_id=${userId}`);
  // Bonita 2025.x: REPEAT `o`, never comma-separate. Comma → HTTP 500
  params.append('o', 'priority DESC');
  params.append('o', 'dueDate ASC');
  return apiRequestWithCount<BonitaTask[]>(`/bpm/humanTask?${params}`);
}
```

## Why a plain `.ts` module (not `.svelte.ts`)?

The API client doesn't hold reactive state — it's just functions. Plain `.ts` is the right choice. Reserve `.svelte.ts` for files that use runes (`$state`, `$derived`, `$effect`).

## Pitfalls

| Symptom | Cause |
|---------|-------|
| 403 on every POST/PUT/DELETE | `getCsrfToken()` returned empty — verify the cookie name matches and is decoded |
| 401 on every call | `credentials: 'include'` missing |
| Returns HTML instead of JSON | Login redirected to portal; missing `redirect: 'false'` in the form body |
| HTTP 500 on multi-criterion `o=` | Use `URLSearchParams.append('o', ...)` per criterion. NOT comma-separated. |
