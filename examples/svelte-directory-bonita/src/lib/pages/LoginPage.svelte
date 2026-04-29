<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { login, getSession } from '../api/auth';
  import { authStore } from '../stores/auth.svelte';

  let username = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // If already authenticated, bounce home
  $effect(() => {
    if (authStore.isAuthenticated) push('/');
  });

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!username || !password) return;
    loading = true;
    error = null;
    try {
      await login(username, password);
      const s = await getSession();
      authStore.setUserFromSession(s);
      push('/');
    } catch {
      error = 'Invalid credentials';
    } finally {
      loading = false;
    }
  }
</script>

<div class="wrapper">
  <form class="card" onsubmit={onSubmit}>
    <h1>Sign in</h1>
    <input type="text" placeholder="Username" autocomplete="username" bind:value={username} required />
    <input type="password" placeholder="Password" autocomplete="current-password" bind:value={password} required />
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={loading}>
      {loading ? 'Signing in…' : 'Sign in'}
    </button>
  </form>
</div>

<style>
  .wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100dvh;
    background: var(--color-bg);
  }
  .card {
    width: 320px;
    padding: 32px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 { margin: 0 0 8px; text-align: center; }
  input {
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font: inherit;
  }
  input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
  button {
    padding: 10px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
  }
  .error { color: #c00; margin: 0; font-size: 14px; }
</style>
