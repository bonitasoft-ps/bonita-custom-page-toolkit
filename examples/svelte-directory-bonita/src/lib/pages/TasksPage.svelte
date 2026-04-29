<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth.svelte';
  import { getMyPendingTasks, type BonitaTask } from '../api/tasks';

  const PRIORITY_COLOR: Record<string, string> = {
    highest: '#c0392b',
    above_normal: '#e67e22',
    normal: '#3498db',
    under_normal: '#16a085',
    lowest: '#7f8c8d',
  };

  let tasks = $state<BonitaTask[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let lastUrl = $state<string | null>(null);
  let lastStatus = $state<string | null>(null);

  async function load() {
    const id = authStore.user?.userId;
    if (!id) {
      error = 'No authenticated user.';
      return;
    }

    const dbg = new URLSearchParams();
    dbg.set('p', '0');
    dbg.set('c', '50');
    dbg.append('f', 'state=ready');
    dbg.append('f', `user_id=${id}`);
    dbg.append('o', 'priority DESC');
    dbg.append('o', 'dueDate ASC');
    lastUrl = `/bonita/API/bpm/humanTask?${dbg}`;

    loading = true;
    error = null;
    try {
      const { data, total: t } = await getMyPendingTasks(id, 0, 50);
      tasks = data;
      total = t >= 0 ? t : data.length;
      lastStatus = `200 OK — ${data.length} tasks (total ${total})`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error = msg;
      lastStatus = 'error';
    } finally {
      loading = false;
    }
  }

  function priorityColor(p: string) {
    return PRIORITY_COLOR[p] ?? '#909399';
  }

  function fmt(d?: string) {
    return d ? new Date(d).toLocaleString() : '—';
  }

  onMount(load);
</script>

<div class="card">
  <header class="card-header">
    <h2>
      My pending tasks
      <span class="count">({total} total)</span>
    </h2>
    <button class="refresh" disabled={loading} onclick={load}>
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </header>

  {#if error}
    <div class="error">
      <strong>Error</strong>
      <pre>{error}</pre>
    </div>
  {/if}

  {#if loading}
    <p class="empty">Loading…</p>
  {:else if tasks.length === 0}
    <p class="empty">No pending tasks for {authStore.user?.userName}.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th class="priority-col">Priority</th>
          <th class="case-col">Case</th>
          <th class="due-col">Due</th>
        </tr>
      </thead>
      <tbody>
        {#each tasks as task (task.id)}
          <tr>
            <td>{task.displayName || task.name}</td>
            <td>
              <span class="badge" style="background: {priorityColor(task.priority)}">
                {task.priority}
              </span>
            </td>
            <td>{task.caseId}</td>
            <td>{fmt(task.dueDate)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <details class="diag">
    <summary>Diagnostic info</summary>
    <pre>userId: {authStore.user?.userId ?? '(not authenticated)'}
userName: {authStore.user?.userName ?? '—'}
last URL: {lastUrl ?? '—'}
last status: {lastStatus ?? '—'}
result count: {tasks.length} (total: {total})</pre>
  </details>
</div>

<style>
  .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04); }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  h2 { margin: 0; font-size: 18px; font-weight: 600; }
  .count { color: #909399; font-weight: 400; margin-left: 8px; font-size: 14px; }
  .refresh { padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 4px; }
  .error { background: #fff1f0; border-left: 4px solid #c00; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 4px 4px 0; }
  .error pre { margin: 8px 0 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #c00; }
  .empty { color: #909399; padding: 24px; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
  th { font-weight: 600; font-size: 13px; color: #606266; background: #fafafa; }
  .priority-col { width: 140px; }
  .case-col { width: 120px; }
  .due-col { width: 200px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; color: white; font-size: 12px; font-weight: 500; }
  .diag { margin-top: 24px; font-size: 12px; color: #606266; border-top: 1px dashed var(--color-border); padding-top: 12px; }
  .diag summary { cursor: pointer; user-select: none; }
  .diag pre { margin: 8px 0 0; background: #fafafa; padding: 8px 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
</style>
