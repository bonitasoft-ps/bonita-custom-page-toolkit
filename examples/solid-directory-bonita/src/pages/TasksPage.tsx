import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { authStore } from '../stores/auth';
import { getMyPendingTasks, type BonitaTask } from '../api/tasks';

const PRIORITY_COLOR: Record<string, string> = {
  highest: '#c0392b',
  above_normal: '#e67e22',
  normal: '#3498db',
  under_normal: '#16a085',
  lowest: '#7f8c8d',
};

export default function TasksPage() {
  const [tasks, setTasks] = createSignal<BonitaTask[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastUrl, setLastUrl] = createSignal<string | null>(null);
  const [lastStatus, setLastStatus] = createSignal<string | null>(null);

  const load = async () => {
    const id = authStore.user?.userId;
    if (!id) {
      setError('No authenticated user.');
      return;
    }
    const dbg = new URLSearchParams();
    dbg.set('p', '0');
    dbg.set('c', '50');
    dbg.append('f', 'state=ready');
    dbg.append('f', `user_id=${id}`);
    dbg.append('o', 'priority DESC');
    dbg.append('o', 'dueDate ASC');
    setLastUrl(`/bonita/API/bpm/humanTask?${dbg}`);

    setLoading(true);
    setError(null);
    try {
      const { data, total: t } = await getMyPendingTasks(id, 0, 50);
      setTasks(data);
      const finalTotal = t >= 0 ? t : data.length;
      setTotal(finalTotal);
      setLastStatus(`200 OK — ${data.length} tasks (total ${finalTotal})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setLastStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Re-load when user becomes available
  createEffect(() => {
    if (authStore.user?.userId) load();
  });

  onMount(load);

  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '—');
  const priorityColor = (p: string) => PRIORITY_COLOR[p] ?? '#909399';

  return (
    <div class="card">
      <header class="card-header">
        <h2>
          My pending tasks <span class="count">({total()} total)</span>
        </h2>
        <button class="refresh" disabled={loading()} onClick={load}>
          {loading() ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <Show when={error()}>
        <div class="error-box">
          <strong>Error</strong>
          <pre>{error()}</pre>
        </div>
      </Show>

      <Show
        when={!loading() && tasks().length > 0}
        fallback={
          <p class="empty">
            {loading()
              ? 'Loading…'
              : `No pending tasks for ${authStore.user?.userName ?? '—'}.`}
          </p>
        }
      >
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
            <For each={tasks()}>
              {(task) => (
                <tr>
                  <td>{task.displayName || task.name}</td>
                  <td>
                    <span class="badge" style={{ background: priorityColor(task.priority) }}>
                      {task.priority}
                    </span>
                  </td>
                  <td>{task.caseId}</td>
                  <td>{fmt(task.dueDate)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <details class="diag">
        <summary>Diagnostic info</summary>
        <pre>{`userId: ${authStore.user?.userId ?? '(not authenticated)'}
userName: ${authStore.user?.userName ?? '—'}
last URL: ${lastUrl() ?? '—'}
last status: ${lastStatus() ?? '—'}
result count: ${tasks().length} (total: ${total()})`}</pre>
      </details>

    </div>
  );
}
