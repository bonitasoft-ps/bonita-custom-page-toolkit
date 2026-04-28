# Router Template — react-router v7 in HashRouter mode

## Why HashRouter

Bonita's Tomcat doesn't rewrite unknown URLs to `index.html`. With `BrowserRouter`, refreshing `/tasks/123` returns 404. `HashRouter` puts the route after `#` (`/#/tasks/123`), so the URL the server sees is always `index.html`.

## src/router.tsx

```tsx
import { createHashRouter, Outlet, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { TasksPage } from '@/pages/TasksPage';
import { getInitialRouteFromParent } from '@/hooks/useParentFrameSync';

// Restore route from parent frame hash (for bookmarks)
const initialRoute = getInitialRouteFromParent();
if (initialRoute) {
  window.location.hash = initialRoute;
}

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'tasks', element: <TasksPage /> },
      // Add more protected routes here
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
```

## Usage in App.tsx

```tsx
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { router } from '@/router';

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#722ED1' } }}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
```

## Programmatic navigation

```tsx
import { useNavigate } from 'react-router-dom';

const Page = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/tasks')}>Go</button>;
};
```

## Reading params

```tsx
import { useParams } from 'react-router-dom';

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  // ... fetch by id
};
```

For the route definition: `{ path: 'task/:id', element: <TaskDetail /> }`

## Linking

```tsx
import { Link } from 'react-router-dom';

<Link to="/tasks">My Tasks</Link>
```

`Link` uses `pushState` internally but in HashRouter it just updates the hash — works correctly inside iframes.

## Why createHashRouter (not HashRouter component)

`createHashRouter` is the data-router API in react-router v7 — it supports `loader`/`action` data fetching, route-level error boundaries, and `useNavigation`. The legacy `<HashRouter>` component still exists but you don't get those features.

For most Bonita custom pages you don't need data routers' loaders — keep using regular `useEffect` for data fetching unless you explicitly want the `loader` pattern.

## Edge case — initial hash

When the user lands on `/bonita/apps/myApp/#/tasks/123`:

1. Browser loads `index.html`
2. React mounts, `createHashRouter` reads `window.location.hash` → `/tasks/123`
3. Renders the matching route directly

If the parent URL has `#/...` but the iframe URL doesn't (because the iframe loaded after the parent), use `getInitialRouteFromParent()` from the iframe-sync helper to copy the parent hash into the iframe's hash before the router initializes. See `iframe-sync.md`.
