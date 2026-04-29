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

export async function getSession(): Promise<BonitaSession> {
  return apiRequest<BonitaSession>('/system/session/unusedId');
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logoutservice`, {
    method: 'GET',
    credentials: 'include',
  });
}
