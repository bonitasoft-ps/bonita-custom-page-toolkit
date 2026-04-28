# Iframe Parent Frame Sync Template

## Problem

When the React app runs inside a Bonita application iframe:
- The iframe URL is fixed (Bonita controls it)
- React Router hash changes (`#/my-tasks`) only update the iframe's URL
- The parent frame's URL bar doesn't reflect the current route
- Users can't bookmark or share deep links

## Solution: useParentFrameSync hook

This hook syncs the React Router hash to the parent frame's URL hash, making routes bookmarkable even inside an iframe.

### src/hooks/useParentFrameSync.ts

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Syncs the current route (from HashRouter) to the parent frame's URL hash.
 * This makes URLs bookmarkable and shareable even when the app runs in a Bonita iframe.
 *
 * Parent URL becomes: /bonita/apps/{appToken}/#/my-tasks
 * On load, if the parent has a hash, navigates to that route.
 */
export function useParentFrameSync() {
  const location = useLocation();

  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        const route = location.pathname + location.search;
        const currentParentHash = window.parent.location.hash;
        const newHash = '#' + route;
        if (currentParentHash !== newHash) {
          window.parent.location.hash = newHash;
        }
      }
    } catch {
      // Cross-origin — can't access parent frame (safe to ignore)
    }
  }, [location.pathname, location.search]);
}

/**
 * Reads the initial route from the parent frame's hash.
 * Call this BEFORE creating the router to restore bookmarked routes.
 */
export function getInitialRouteFromParent(): string | null {
  try {
    if (window.parent && window.parent !== window) {
      const hash = window.parent.location.hash;
      if (hash && hash.length > 1) {
        return hash.slice(1); // Remove the leading #
      }
    }
  } catch {
    // Cross-origin — can't access parent frame
  }
  return null;
}
```

## Usage in router.tsx

```typescript
import { createHashRouter } from 'react-router-dom';
import { getInitialRouteFromParent } from '@hooks/useParentFrameSync';

// Restore route from parent frame hash (for bookmarks/shared URLs)
const initialRoute = getInitialRouteFromParent();
if (initialRoute) {
  window.location.hash = initialRoute;
}

export const router = createHashRouter([
  // ... routes
]);
```

## Usage in Layout component

```typescript
import { useParentFrameSync } from '@hooks/useParentFrameSync';

export const AppLayout = () => {
  useParentFrameSync(); // Syncs on every route change

  return (
    <div className="app-layout">
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  );
};
```

## How it works

```
1. User bookmarks: /bonita/apps/MyApp/#/admin/dashboard
2. User opens bookmark
3. Bonita loads the application, iframe loads the custom page
4. getInitialRouteFromParent() reads parent hash → "/admin/dashboard"
5. Sets window.location.hash = "/admin/dashboard"
6. HashRouter picks up the hash and renders the correct route
7. useParentFrameSync keeps parent hash in sync as user navigates
```

## Edge cases

### App runs standalone (not in iframe)
- `window.parent === window` → hooks are no-ops
- Hash routing still works normally

### Cross-origin iframe
- `window.parent.location` throws → caught silently
- The app works fine, just no URL sync with parent

### No hash in parent URL
- `getInitialRouteFromParent()` returns null
- Router uses default route (usually `/` → home page)
