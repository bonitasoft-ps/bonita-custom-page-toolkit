<script lang="ts">
  import Router, { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import LoginPage from './lib/pages/LoginPage.svelte';
  import Layout from './lib/pages/Layout.svelte';
  import { authStore } from './lib/stores/auth.svelte';
  import { setSessionExpiredHandler } from './lib/api/client';

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
  <div class="booting">
    <p>Loading…</p>
  </div>
{:else}
  <Router {routes} />
{/if}

<style>
  .booting {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100dvh;
    color: #909399;
  }
</style>
