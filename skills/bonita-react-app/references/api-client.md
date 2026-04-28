# API Client Template for Bonita React App

## src/api/client.ts

This is the centralized HTTP client. Every API call goes through `apiRequest()`, which handles:
- CSRF token injection (X-Bonita-API-Token)
- Session cookie forwarding (`credentials: 'include'`)
- Session expiration detection (401/403 → logout)
- Response parsing (JSON, empty body, 204 No Content)

```typescript
const BASE_URL = import.meta.env.VITE_BONITA_URL || '/bonita';

let apiToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const setApiToken = (token: string) => {
  apiToken = token;
};

export const clearApiToken = () => {
  apiToken = null;
};

export const getApiToken = () => apiToken;

/** Register a callback invoked when the API detects a 401/403 */
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

/** Read X-Bonita-API-Token cookie (set at login by Bonita) */
const getCsrfTokenFromCookie = (): string | null => {
  const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}/API${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // CSRF token: prefer cookie (always fresh), fallback to stored token
  const csrfToken = getCsrfTokenFromCookie() || apiToken;
  if (csrfToken) {
    headers['X-Bonita-API-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // CRITICAL: send session cookies
  });

  if (!response.ok) {
    // Session expired — trigger logout only if user was previously authenticated
    if (response.status === 401 || response.status === 403) {
      const wasAuthenticated = !!apiToken;
      clearApiToken();
      if (wasAuthenticated) {
        onSessionExpired?.();
      }
      throw new Error('Session expired');
    }
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `API Error ${response.status}${errorBody ? `: ${errorBody.slice(0, 200)}` : ''}`
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined as T;
  }
}
```

## Usage pattern — creating API modules

Each domain gets its own file that imports `apiRequest`:

```typescript
// src/api/tasks.ts
import { apiRequest } from './client';

interface Task {
  id: string;
  name: string;
  assignedId: string;
  // ...
}

export async function getMyTasks(page = 0, size = 20): Promise<Task[]> {
  return apiRequest<Task[]>(
    `/bpm/humanTask?p=${page}&c=${size}&f=state=ready&f=user_id={userId}&o=priority DESC`
  );
}

export async function completeTask(taskId: string, variables: Record<string, unknown>): Promise<void> {
  return apiRequest(`/bpm/userTask/${taskId}/execution`, {
    method: 'POST',
    body: JSON.stringify(variables),
  });
}
```

## For REST API Extensions

Bonita REST API extensions are served under `/API/extension/`:

```typescript
export async function getCustomData(): Promise<CustomData> {
  return apiRequest<CustomData>('/extension/{extensionName}/{endpoint}');
}
```

## Key design decisions

### Why module-level state (not React state) for the token?

The API client must work outside React (e.g., in interceptors, error handlers). Module-level variables are accessible from anywhere. The Zustand store mirrors this state for React components.

### Why `credentials: 'include'`?

Bonita uses `JSESSIONID` session cookies. Without `include`, the browser won't send cookies on cross-origin requests (dev proxy) or same-origin requests from iframes.

### Why cookie-first for CSRF token?

The cookie is set by Bonita and stays fresh. The stored token (`apiToken`) is a fallback for edge cases where the cookie isn't available yet (e.g., immediately after login before the cookie propagates).
