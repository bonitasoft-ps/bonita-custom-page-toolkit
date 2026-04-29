# SolidJS stores — `createStore` pattern

For an auth store (or any state with multiple related fields), use `createStore` from `solid-js/store` rather than juggling several `createSignal`s.

## Full auth store template

```ts
// src/stores/auth.ts
import { createStore } from 'solid-js/store';
import { getSession, logout as apiLogout } from '../api/auth';
import type { BonitaSession } from '../api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

const [state, setState] = createStore<AuthState>({
  user: null,
  isLoading: true,
});

function toUser(s: BonitaSession): AuthUser {
  return {
    userId: s.user_id,
    userName: s.user_name,
    displayName: s.user_name,
    isTechnicalUser: s.is_technical_user,
  };
}

export const authStore = {
  get user() { return state.user; },
  get isLoading() { return state.isLoading; },
  get isAuthenticated() { return state.user !== null; },

  async loadSession() {
    setState('isLoading', true);
    try {
      const s = await getSession();
      setState('user', toUser(s));
    } catch {
      setState('user', null);
    } finally {
      setState('isLoading', false);
    }
  },

  setUserFromSession(s: BonitaSession) {
    setState('user', toUser(s));
  },

  async logoutAndClear() {
    try {
      await apiLogout();
    } finally {
      setState('user', null);
    }
  },

  clearUser() {
    setState('user', null);
  },
};
```

## Why getters (`get user()`)?

The plain field `user` would expose the proxy object directly. Wrapping it in a getter:

1. **Hides the setter** — consumers can't accidentally do `authStore.user = X`. They must call a method.
2. **Maintains reactivity** — Solid tracks the read inside the getter when `authStore.user` is accessed in a tracking scope (component, `createEffect`, `Show`).
3. **Composes naturally** — `get isAuthenticated()` derives from `state.user` automatically.

## Why not multiple `createSignal`s?

Plain signals would look like:
```ts
const [user, setUser] = createSignal<User | null>(null);
const [isLoading, setIsLoading] = createSignal(true);
```

This works for two fields. For three or more it gets noisy, methods need explicit imports of every setter, and TypeScript inference is per-signal. `createStore` collapses everything into a single state object with a single setter that takes a path.

## Consuming in a component

```tsx
import { Show } from 'solid-js';
import { authStore } from '../stores/auth';

export default function Dashboard() {
  return (
    <Show when={authStore.isAuthenticated} fallback={<p>Please log in.</p>}>
      <p>Welcome, {authStore.user?.displayName}</p>
      <button onClick={() => authStore.logoutAndClear()}>Logout</button>
    </Show>
  );
}
```

`authStore.user` is a getter that reads `state.user` — Solid tracks it. No `()` call needed (unlike `createSignal` directly).

## Mutating nested fields

`createStore` supports path-based updates:

```ts
setState('user', { ...state.user, displayName: 'New' });        // replace user
setState('user', 'displayName', 'New');                          // set just one field
setState('user', (u) => ({ ...u, displayName: u.displayName + '!' }));  // updater
```

For deeply-nested fields you can keep going:
```ts
setState('user', 'preferences', 'theme', 'dark');
```

## When NOT to use createStore

- Local component state (a counter, a form input value) — use `createSignal`
- Static data (config constants) — plain `const`
- Derived values — `createMemo` or computed getter

## Pitfalls

| Symptom | Cause |
|---------|-------|
| Updates don't propagate | Reading `state.user` once outside the component (e.g. in a module-level `const x = state.user`) and using that copy. The store is only reactive when read within a tracking scope. |
| Can't mutate primitive directly | `setState('isLoading', true)` is correct. `state.isLoading = true` does NOTHING (read-only proxy). |
| `Cannot read properties of null` | Forgot `?.` chain on optional fields: `authStore.user?.userId` |

## Combining stores

For larger apps, one store per domain:

```ts
// stores/auth.ts → exports authStore
// stores/tasks.ts → exports tasksStore
// stores/theme.ts → exports themeStore
```

Each in its own file. Stores can import each other freely.
