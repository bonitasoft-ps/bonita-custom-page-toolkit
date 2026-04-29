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
  const token = getCsrfToken();
  const headers = new Headers(init.headers);
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
  if (!res.ok) throw new Error(`API ${res.status}`);

  const range = res.headers.get('Content-Range');
  const total = range ? Number(range.split('/')[1]) : -1;
  const data = (await res.json()) as T;
  return { data, total };
}
