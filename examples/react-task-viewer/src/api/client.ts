const BASE_URL = import.meta.env.VITE_BONITA_URL || '/bonita';

let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

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
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['X-Bonita-API-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 || response.status === 403) {
    onSessionExpired?.();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text);
  } catch {
    return undefined as T;
  }
}

export async function apiRequestWithCount<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; total: number }> {
  const url = `${BASE_URL}/API${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) headers['X-Bonita-API-Token'] = csrfToken;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 || response.status === 403) {
    onSessionExpired?.();
    throw new Error('Session expired');
  }
  if (!response.ok) throw new Error(`API ${response.status}`);

  const range = response.headers.get('Content-Range');
  const total = range ? Number(range.split('/')[1]) : -1;
  const data = (await response.json()) as T;
  return { data, total };
}
