# Svelte 5 stores — class-based runes pattern

In Svelte 5, the recommended way to share state across components is a **class with `$state` fields**, instantiated once and exported from a `.svelte.ts` module.

## Full auth store template

```ts
// src/lib/stores/auth.svelte.ts
import { getSession, logout as apiLogout } from '../api/auth';
import type { BonitaSession } from '../api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

class AuthStore {
  user = $state<AuthUser | null>(null);
  isLoading = $state(true);

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  async loadSession(): Promise<void> {
    this.isLoading = true;
    try {
      const s = await getSession();
      this.user = this.toUser(s);
    } catch {
      this.user = null;
    } finally {
      this.isLoading = false;
    }
  }

  setUserFromSession(s: BonitaSession): void {
    this.user = this.toUser(s);
  }

  async logoutAndClear(): Promise<void> {
    try {
      await apiLogout();
    } finally {
      this.user = null;
    }
  }

  clearUser(): void {
    this.user = null;
  }

  private toUser(s: BonitaSession): AuthUser {
    return {
      userId: s.user_id,
      userName: s.user_name,
      displayName: s.user_name,
      isTechnicalUser: s.is_technical_user,
    };
  }
}

export const authStore = new AuthStore();
```

## Why `.svelte.ts` and not `.ts`?

Runes (`$state`, `$derived`, `$effect`) are only enabled inside files compiled by the Svelte compiler. The compiler runs on `.svelte` and `.svelte.ts` files. A plain `.ts` file is processed by `tsc`/`esbuild` and the `$state` symbol is undefined → build error.

Rule: any module that holds reactive state goes in `.svelte.ts`.

## Why a class, not multiple `writable` stores?

Legacy Svelte:
```ts
import { writable, derived } from 'svelte/store';
export const user = writable<User | null>(null);
export const isAuthenticated = derived(user, ($u) => $u !== null);
// In component: $user, $isAuthenticated (the $ prefix subscribes)
```

This works but has issues:
- Each `writable` is a separate symbol — methods that touch multiple stores need explicit imports
- The `$` prefix has implicit subscription semantics that can confuse new devs
- Type inference is weaker (you have to type each writable individually)

Class-based:
- One store, one symbol, all related state co-located
- Methods can mutate multiple fields atomically
- TypeScript infers everything from the class shape
- No `$` prefix needed in components (`authStore.user` is plain property access; the runes compiler tracks it)

## Using the store in a component

```svelte
<script lang="ts">
  import { authStore } from '../stores/auth.svelte';
  import { push } from 'svelte-spa-router';

  // Reactive: re-evaluates on every state change
  $effect(() => {
    if (authStore.isAuthenticated) push('/');
  });

  async function onLogout() {
    await authStore.logoutAndClear();
    push('/login');
  }
</script>

{#if authStore.isAuthenticated}
  <p>Hello {authStore.user?.displayName}</p>
  <button onclick={onLogout}>Logout</button>
{/if}
```

No `$` prefix, no manual subscription. The Svelte compiler reads `authStore.user` and `authStore.isAuthenticated` and tracks them automatically.

## When to use multiple stores

Big apps may want one store per domain (`authStore`, `tasksStore`, `themeStore`). Each in its own `.svelte.ts` file. Stores can import each other.

For a small Bonita custom page, ONE auth store + per-page local signals (`$state` declared inside `.svelte` files) usually covers everything.

## Pitfalls

| Symptom | Cause |
|---------|-------|
| `$state is not defined` at build time | The file is `.ts` instead of `.svelte.ts` |
| Methods see stale state | Don't reach into `this.user` in async functions — close over a local copy if needed |
| Component doesn't re-render after store update | The store property is being **mutated** (`arr.push(x)`) instead of replaced (`arr = [...arr, x]`) |
| `cannot read property 'X' of null` | Forgot the `?.` chain — `authStore.user?.userId` is the safe form |
