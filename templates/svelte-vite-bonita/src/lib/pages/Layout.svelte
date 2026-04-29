<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { authStore } from '../stores/auth.svelte';
  import TasksPage from './TasksPage.svelte';
  import { onMount } from 'svelte';

  // Guard — if not authenticated, redirect to login
  onMount(() => {
    if (!authStore.isAuthenticated) push('/login');
  });

  async function onLogout() {
    await authStore.logoutAndClear();
    push('/login');
  }
</script>

{#if authStore.isAuthenticated}
  <div class="layout">
    <header class="topbar">
      <h1>__DISPLAY_NAME__</h1>
      <div class="actions">
        <span class="user">{authStore.user?.displayName}</span>
        <button class="logout" onclick={onLogout}>Logout</button>
      </div>
    </header>
    <main class="content">
      <TasksPage />
    </main>
  </div>
{/if}

<style>
  .layout { min-height: 100dvh; display: flex; flex-direction: column; }
  .topbar {
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 64px;
  }
  h1 { margin: 0; font-size: 20px; font-weight: 600; }
  .actions { display: flex; align-items: center; gap: 16px; }
  .user { color: rgba(255, 255, 255, 0.85); }
  .logout {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.5);
    padding: 6px 16px;
    border-radius: 4px;
  }
  .logout:hover { background: rgba(255, 255, 255, 0.1); }
  .content { flex: 1; padding: 24px; }
</style>
