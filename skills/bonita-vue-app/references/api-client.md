# API Client Template — Vue 3 + Bonita

A plain-module HTTP wrapper. No Vue imports — usable from stores, composables, and route guards alike.

## src/api/client.ts

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

/**
 * Read pagination total from Content-Range header.
 * Returns -1 if the header is missing.
 */
export async function apiRequestWithCount<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; total: number }> {
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
    throw new Error(`API ${res.status}`);
  }

  const range = res.headers.get('Content-Range');
  const total = range ? Number(range.split('/')[1]) : -1;
  const data = (await res.json()) as T;
  return { data, total };
}
```

## src/api/auth.ts

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
  const res = await fetch(`${BASE}/loginservice`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password, redirect: 'false' }),
  });
  if (!res.ok) throw new Error('Login failed');
}

export async function getSession(): Promise<BonitaSession> {
  return apiRequest<BonitaSession>('/system/session/unusedId');
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logoutservice`, {
    method: 'GET',
    credentials: 'include',
  });
}
```

## Domain modules — example

```ts
// src/api/tasks.ts
import { apiRequest } from './client';

export interface Task {
  id: string;
  name: string;
  caseId: string;
  state: string;
  priority: string;
  dueDate?: string;
  description?: string;
}

export async function getMyTasks(userId: string, page = 0, size = 20): Promise<Task[]> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('f', 'state=ready');
  params.append('f', `user_id=${userId}`);
  // Bonita 2025.x: one `o` per ordering criterion, NOT comma-separated (returns 500)
  params.append('o', 'priority DESC');
  params.append('o', 'dueDate ASC');
  return apiRequest<Task[]>(`/bpm/humanTask?${params}`);
}

export async function executeTask(taskId: string, vars: Record<string, unknown> = {}): Promise<void> {
  return apiRequest(`/bpm/userTask/${taskId}/execution`, {
    method: 'POST',
    body: JSON.stringify(vars),
  });
}
```

## Why a plain module (not a Vue plugin)

Pinia stores, route guards (`beforeEach`), `App.vue` `onMounted`, and pages all need to call APIs. A plugin needs `app.config.globalProperties` access, which only works inside components. A plain module is callable from anywhere.

If you prefer a Vue 3 idiom, wrap it as a composable:

```ts
export function useApi() {
  return { apiRequest, apiRequestWithCount };
}
```

…but it adds nothing — just import the function directly.

## Why `URLSearchParams` for filter arrays

Bonita's filter syntax is `f=key=value` repeated for multiple filters:

```
GET /API/bpm/humanTask?p=0&c=20&f=state=ready&f=user_id=123
```

`URLSearchParams.append('f', '...')` correctly serialises this. Using `new URLSearchParams({ f: ['a', 'b'] })` does NOT — it joins with commas, which Bonita rejects.
