# Svelte routing for Bonita — `svelte-spa-router`

Bonita's Tomcat doesn't rewrite SPA paths to `index.html`, so we need **hash routing**. Svelte 5 doesn't ship a built-in router — `svelte-spa-router` is the lightest option that does pure hash routing without needing a server.

## Installation

```bash
npm install svelte-spa-router
```

That's the only dependency. ~5 KB gzip.

## Basic setup — App.svelte

```svelte
<script lang="ts">
  import Router, { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import LoginPage from './lib/pages/LoginPage.svelte';
  import Layout from './lib/pages/Layout.svelte';
  import { authStore } from './lib/stores/auth.svelte';
  import { setSessionExpiredHandler } from './lib/api/client';

  // The * route catches everything that's not /login.
  // Layout component shows the chrome (header + content).
  const routes = {
    '/login': LoginPage,
    '*': Layout,
  };

  let booting = $state(true);

  onMount(async () => {
    setSessionExpiredHandler(() => {
      authStore.clearUser();
      push('/login');
    });
    await authStore.loadSession();
    booting = false;
    if (!authStore.isAuthenticated && !location.hash.startsWith('#/login')) {
      push('/login');
    }
  });
</script>

{#if booting}
  <div class="booting">Loading…</div>
{:else}
  <Router {routes} />
{/if}
```

## Programmatic navigation

```ts
import { push, pop, replace } from 'svelte-spa-router';

push('/tasks');                    // navigate
push('/tasks/123', { state: x });  // with state
replace('/login');                  // replace history
pop();                              // back
```

## Reading params

For a route `/tasks/:id`:

```svelte
<script lang="ts">
  import { params } from 'svelte-spa-router';
  // `$params` is a Svelte store; in runes mode use the legacy $store syntax for it
  $: taskId = $params?.id;
</script>

<h1>Task {taskId}</h1>
```

Note: `params` is a legacy writable store from svelte-spa-router itself, so the `$params` subscription syntax IS needed for it (unlike our runes-based stores).

## Linking

```svelte
<a href="#/tasks">My Tasks</a>
<a href="#/tasks/{task.id}">View {task.name}</a>
```

Plain anchor tags with hash hrefs. svelte-spa-router intercepts them.

## More routes

```ts
import HomePage from './pages/HomePage.svelte';
import TasksPage from './pages/TasksPage.svelte';
import TaskDetailPage from './pages/TaskDetailPage.svelte';

const routes = {
  '/login': LoginPage,
  '/': HomePage,
  '/tasks': TasksPage,
  '/tasks/:id': TaskDetailPage,
  '*': Layout, // catch-all (shows the chrome and a 404 / home)
};
```

## Why not `@sveltejs/kit`?

SvelteKit is a full meta-framework with file-based routing, SSR, server endpoints, etc. For a Bonita custom page (single page, no SSR, no server endpoints), it's overkill — the build output isn't a single SPA, it's multiple HTML files designed to be served by a Node server.

Stick with raw Svelte 5 + Vite + svelte-spa-router for custom pages.

## Edge cases

### Initial route from parent frame

If a user bookmarks `/bonita/apps/myApp/#/tasks/123` and the iframe URL doesn't have the hash on first load, the parent's hash takes precedence. Copy it before mounting:

```ts
// main.ts BEFORE mount(App)
try {
  if (window.parent && window.parent !== window) {
    const parentHash = window.parent.location.hash;
    if (parentHash && !location.hash) location.hash = parentHash;
  }
} catch { /* cross-origin */ }
```

For most simple cases, this isn't needed — the iframe and parent share origin and Bonita preserves the hash automatically.

### Route guards

`svelte-spa-router` supports per-route guards via the `conditions` option, but for most Bonita pages a simpler check inside the page component is enough:

```svelte
<!-- Layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth.svelte';
  import { push } from 'svelte-spa-router';

  onMount(() => {
    if (!authStore.isAuthenticated) push('/login');
  });
</script>

{#if authStore.isAuthenticated}
  <slot />
{/if}
```

This is simpler than wiring `conditions` and the user experience is the same.
