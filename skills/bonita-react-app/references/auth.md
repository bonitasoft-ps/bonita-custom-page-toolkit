# Authentication Template for Bonita React App

## Overview

Bonita authentication uses:
1. **Session cookies** (`JSESSIONID`) — managed by Tomcat, sent automatically
2. **CSRF token** (`X-Bonita-API-Token`) — set as a cookie at login, must be sent as a header
3. **Session API** — `GET /bonita/API/system/session/unusedId` to check if a session exists

## src/api/auth.ts

```typescript
const BASE_URL = import.meta.env.VITE_BONITA_URL || '/bonita';

export interface BonitaSession {
  user_id: string;
  user_name: string;
  session_id: string;
  conf: string[];
  is_technical_user: boolean;
  token: string;  // This is the CSRF token
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/loginservice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username,
      password,
      redirect: 'false',  // Prevent Bonita from redirecting to its own portal
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }
}

export async function getSession(): Promise<BonitaSession> {
  const response = await fetch(`${BASE_URL}/API/system/session/unusedId`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Not authenticated');
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/logoutservice`, {
    method: 'GET',
    credentials: 'include',
  });
}
```

## src/stores/authStore.ts

```typescript
import { create } from 'zustand';
import { clearApiToken } from '@api/client';

export interface AuthUser {
  userId: string;
  userName: string;
  firstname: string;
  lastname: string;
  displayName: string;
  // Add app-specific role flags here
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;

  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  setAuthenticated: (auth: boolean) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,  // Start as loading — session check happens on mount
  token: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    clearApiToken();
    set({ user: null, isAuthenticated: false, token: null });
  },
}));
```

## Session check in App.tsx

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '@stores/authStore';
import { getSession } from '@api/auth';
import { setApiToken, setSessionExpiredHandler } from '@api/client';

const App = () => {
  const { setUser, setAuthenticated, setLoading, setToken } = useAuthStore();

  // Register session expiration handler (once)
  useEffect(() => {
    setSessionExpiredHandler(() => {
      useAuthStore.getState().logout();
      window.location.hash = '#/login';
    });
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        setToken(session.token);
        setApiToken(session.token);

        // Load user details from Bonita API
        // const userInfo = await getUserById(session.user_id);
        
        setUser({
          userId: session.user_id,
          userName: session.user_name,
          firstname: '', // Fill from user API
          lastname: '',
          displayName: session.user_name,
        });
        setAuthenticated(true);
      } catch {
        // No valid session — user must login
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // ... render app
};
```

## src/components/ProtectedRoute.tsx

```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin }: Props) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Optional: admin check (adapt to your user model)
  // if (requireAdmin && !user?.isAdmin) {
  //   return <Navigate to="/" replace />;
  // }

  return <>{children}</>;
};
```

## Login Page pattern

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { login, getSession } from '@api/auth';
import { useAuthStore } from '@stores/authStore';
import { setApiToken } from '@api/client';

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken, setAuthenticated } = useAuthStore();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      const session = await getSession();
      setToken(session.token);
      setApiToken(session.token);
      setUser({
        userId: session.user_id,
        userName: session.user_name,
        // ... load full user details
      });
      setAuthenticated(true);
      navigate('/');
    } catch {
      message.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onFinish={onFinish}>
      <Form.Item name="username" rules={[{ required: true }]}>
        <Input placeholder="Username" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true }]}>
        <Input.Password placeholder="Password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}>
        Login
      </Button>
    </Form>
  );
};
```

## Key points

### Why `isLoading: true` by default?

The session check is async. Without a loading state, the app would flash the login page before the session check completes, then redirect to the dashboard. Starting with `isLoading: true` prevents this flash.

### Why `redirect: 'false'` in login?

Without this, Bonita's `/loginservice` returns a 302 redirect to the Bonita portal. We want a simple 200 OK so the React app stays in control of navigation.

### Session restoration in iframe context

When the React app loads inside a Bonita application iframe, the user is **already logged in**. The `getSession()` call will succeed immediately, and the login page is never shown. The login page is only needed when the app runs standalone (dev mode or direct URL access).
