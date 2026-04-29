import { createSignal, createMemo, createEffect, Show, For, onMount } from 'solid-js';
import { authStore } from '../stores/auth';
import { loadSnapshot, type BpmSnapshot, type BonitaTask } from '../api/bpm';

const PRIORITIES = ['highest', 'above_normal', 'normal', 'under_normal', 'lowest'] as const;
type Priority = (typeof PRIORITIES)[number];
const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  highest:      { label: 'Highest', color: '#c0392b' },
  above_normal: { label: 'High',    color: '#e67e22' },
  normal:       { label: 'Normal',  color: '#3498db' },
  under_normal: { label: 'Low',     color: '#16a085' },
  lowest:       { label: 'Lowest',  color: '#7f8c8d' },
};

function isOverdue(t: BonitaTask) { return !!t.dueDate && new Date(t.dueDate).getTime() < Date.now(); }
function isDueToday(t: BonitaTask) {
  if (!t.dueDate) return false;
  const d = new Date(t.dueDate); const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
function priorityColor(p: string) { return PRIORITY_META[p as Priority]?.color ?? '#909399'; }
function priorityLabel(p: string) { return PRIORITY_META[p as Priority]?.label ?? p; }
function fmt(d?: string) { return d ? new Date(d).toLocaleString() : '—'; }

export default function TasksPage() {
  const [snapshot, setSnapshot] = createSignal<BpmSnapshot | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [priorityFilter, setPriorityFilter] = createSignal<Priority | 'all'>('all');
  const [sortBy, setSortBy] = createSignal<'priority' | 'dueDate' | 'name'>('priority');
  const [detailTask, setDetailTask] = createSignal<BonitaTask | null>(null);
  const [activeTab, setActiveTab] = createSignal<'tasks' | 'cases' | 'processes'>('tasks');

  const load = async () => {
    if (!authStore.user?.userId) return;
    setLoading(true);
    try { setSnapshot(await loadSnapshot(authStore.user.userId)); }
    finally { setLoading(false); }
  };

  onMount(load);
  createEffect(() => { if (authStore.user?.userId) load(); });

  const tasks = createMemo(() => snapshot()?.tasks.data ?? []);
  const tasksTotal = createMemo(() => snapshot()?.tasks.total ?? 0);
  const processes = createMemo(() => snapshot()?.processes.data ?? []);
  const processesTotal = createMemo(() => snapshot()?.processes.total ?? 0);
  const openCases = createMemo(() => snapshot()?.openCases.data ?? []);
  const openCasesTotal = createMemo(() => snapshot()?.openCases.total ?? 0);
  const closedToday = createMemo(() => snapshot()?.closedToday.data ?? []);
  const closedTodayTotal = createMemo(() => snapshot()?.closedToday.total ?? 0);
  const enabledProcesses = createMemo(() => processes().filter(p => p.activationState === 'ENABLED').length);

  const stats = createMemo(() => {
    const t = tasks();
    const overdue = t.filter(isOverdue).length;
    const dueToday = t.filter(isDueToday).length;
    const highPriority = t.filter(x => x.priority === 'highest' || x.priority === 'above_normal').length;
    const distribution: Record<Priority, number> = { highest:0, above_normal:0, normal:0, under_normal:0, lowest:0 };
    for (const x of t) {
      const p = (PRIORITIES.includes(x.priority as Priority) ? x.priority : 'normal') as Priority;
      distribution[p]++;
    }
    const maxCount = Math.max(1, ...Object.values(distribution));
    return { overdue, dueToday, highPriority, distribution, maxCount };
  });

  const visibleTasks = createMemo(() => {
    const lower = search().trim().toLowerCase();
    const rank: Record<string, number> = { highest:0, above_normal:1, normal:2, under_normal:3, lowest:4 };
    return tasks().filter(t => {
      if (priorityFilter() !== 'all' && t.priority !== priorityFilter()) return false;
      if (!lower) return true;
      return `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase().includes(lower);
    }).slice().sort((a, b) => {
      if (sortBy() === 'priority') return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (sortBy() === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
  });

  const distributionEntries = createMemo(() => {
    const s = stats();
    const total = Math.max(1, tasks().length);
    return PRIORITIES.map(p => ({
      priority: p,
      count: s.distribution[p],
      pct: Math.round((s.distribution[p] / total) * 100),
      color: PRIORITY_META[p].color,
      label: PRIORITY_META[p].label,
    }));
  });

  const pressurePct = (t: BonitaTask) => {
    if (isOverdue(t)) return 100;
    if (isDueToday(t)) return 80;
    if (t.dueDate) return 40;
    return 10;
  };
  const pressureColor = (t: BonitaTask) => {
    if (isOverdue(t)) return '#c0392b';
    if (isDueToday(t)) return '#e67e22';
    return '#3498db';
  };

  return (
    <div class="dashboard">
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#2C4F7C' }}>⬡</div>
            <div>
              <div class="kpi-title">Active processes</div>
              <div class="kpi-value">
                {enabledProcesses()}
                <Show when={processesTotal() > 0}>
                  <span class="kpi-suffix">/ {processesTotal()}</span>
                </Show>
              </div>
              <div class="kpi-sub">Deployed and enabled</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#3498db' }}>📁</div>
            <div>
              <div class="kpi-title">Open cases</div>
              <div class="kpi-value">{openCasesTotal() >= 0 ? openCasesTotal() : openCases().length}</div>
              <div class="kpi-sub">In-flight process instances</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#16a085' }}>✓</div>
            <div>
              <div class="kpi-title">Closed today</div>
              <div class="kpi-value">{closedTodayTotal() >= 0 ? closedTodayTotal() : closedToday().length}</div>
              <div class="kpi-sub">Cases archived since 00:00</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#e67e22' }}>🚀</div>
            <div>
              <div class="kpi-title">My tasks</div>
              <div class="kpi-value">{tasksTotal()}</div>
              <div class="kpi-sub">Pending in my inbox</div>
            </div>
          </div>
        </div>
      </div>

      <div class="kpi-row kpi-row-secondary">
        <div class={`kpi-card kpi-mini ${stats().overdue > 0 ? 'kpi-warn' : ''}`}>
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#c0392b' }}>⚠</div>
            <div>
              <div class="kpi-title">Overdue</div>
              <div class="kpi-value" style={{ color: stats().overdue > 0 ? '#c0392b' : undefined }}>
                {stats().overdue}
              </div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-mini">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#e67e22' }}>📅</div>
            <div><div class="kpi-title">Due today</div><div class="kpi-value">{stats().dueToday}</div></div>
          </div>
        </div>
        <div class="kpi-card kpi-mini">
          <div class="kpi-content">
            <div class="kpi-icon" style={{ color: '#e67e22' }}>🔥</div>
            <div><div class="kpi-title">High priority</div><div class="kpi-value">{stats().highPriority}</div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Task priority distribution</h2></div>
        <Show when={tasks().length > 0} fallback={<p class="empty">No tasks to chart</p>}>
          <div class="distribution-bars">
            <For each={distributionEntries()}>
              {(e) => (
                <div class="dist-row">
                  <div class="dist-label">
                    <span class="priority-dot" style={{ background: e.color }} />
                    <span>{e.label}</span>
                  </div>
                  <div class="dist-bar-track">
                    <div
                      class="dist-bar-fill"
                      style={{ width: `${(e.count / stats().maxCount) * 100}%`, background: e.color }}
                      title={`${e.count} tasks (${e.pct}%)`}
                    />
                  </div>
                  <div class="dist-count">{e.count}</div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="card tabs-card">
        <div class="tabs-nav">
          <button class={`tab-btn ${activeTab() === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            ⏱ My tasks ({visibleTasks().length})
          </button>
          <button class={`tab-btn ${activeTab() === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
            📁 Open cases ({openCases().length})
          </button>
          <button class={`tab-btn ${activeTab() === 'processes' ? 'active' : ''}`} onClick={() => setActiveTab('processes')}>
            ⬡ Processes ({processes().length})
          </button>
        </div>
        <div class="tab-body">
          <Show when={activeTab() === 'tasks'}>
            <Show when={snapshot()?.tasks.error}>
              <div class="alert alert-error"><strong>Failed to load tasks:</strong> {snapshot()?.tasks.error}</div>
            </Show>
            <div class="filters-bar">
              <input class="filter-input" type="text" placeholder="🔍  Search by name or case…"
                     value={search()} onInput={(e) => setSearch(e.currentTarget.value)} />
              <select class="filter-select" value={priorityFilter()} onChange={(e) => setPriorityFilter(e.currentTarget.value as Priority | 'all')}>
                <option value="all">All priorities</option>
                <For each={PRIORITIES}>{(p) => <option value={p}>{priorityLabel(p)}</option>}</For>
              </select>
              <select class="filter-select" value={sortBy()} onChange={(e) => setSortBy(e.currentTarget.value as any)}>
                <option value="priority">By priority</option>
                <option value="dueDate">By due date</option>
                <option value="name">By name</option>
              </select>
              <button class="btn-primary" disabled={loading()} onClick={load}>
                {loading() ? 'Loading…' : '⟳ Refresh all'}
              </button>
            </div>
            <Show
              when={visibleTasks().length > 0}
              fallback={
                <p class="empty">
                  {tasks().length === 0
                    ? 'No pending tasks. Enjoy the silence.'
                    : 'No tasks match the current filters.'}
                </p>
              }
            >
              <table class="data-table">
                <thead>
                  <tr><th>Task</th><th class="priority-col">Priority</th><th class="case-col">Case</th><th class="due-col">Due</th><th></th></tr>
                </thead>
                <tbody>
                  <For each={visibleTasks()}>
                    {(task) => (
                      <tr classList={{ 'row-overdue': isOverdue(task) }}>
                        <td>
                          <div class="task-cell">
                            <span class="priority-dot" style={{ background: priorityColor(task.priority) }} />
                            <div>
                              <div class="task-name">
                                <strong>{task.displayName || task.name}</strong>
                                <Show when={isOverdue(task)}>
                                  <span class="badge badge-danger">Overdue</span>
                                </Show>
                                <Show when={!isOverdue(task) && isDueToday(task)}>
                                  <span class="badge badge-warning">Today</span>
                                </Show>
                              </div>
                              <Show when={task.description}>
                                <div class="task-desc">{task.description}</div>
                              </Show>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="badge" style={{ background: priorityColor(task.priority) }}>
                            {priorityLabel(task.priority)}
                          </span>
                        </td>
                        <td><code>#{task.caseId}</code></td>
                        <td>{fmt(task.dueDate)}</td>
                        <td><button class="btn-secondary" onClick={() => setDetailTask(task)}>Details</button></td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </Show>

          <Show when={activeTab() === 'cases'}>
            <Show when={snapshot()?.openCases.error}>
              <div class="alert alert-warn"><strong>Limited access:</strong> {snapshot()?.openCases.error}</div>
            </Show>
            <Show when={openCases().length > 0} fallback={<p class="empty">No open cases</p>}>
              <table class="data-table">
                <thead>
                  <tr><th class="case-col">Case</th><th class="due-col">Started</th><th>Started by</th><th>Process</th></tr>
                </thead>
                <tbody>
                  <For each={openCases()}>
                    {(c) => (
                      <tr>
                        <td><code>#{c.id}</code></td>
                        <td>{fmt(c.start)}</td>
                        <td>{c.started_by || '—'}</td>
                        <td><code>{c.processDefinitionId}</code></td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </Show>

          <Show when={activeTab() === 'processes'}>
            <Show when={snapshot()?.processes.error}>
              <div class="alert alert-warn"><strong>Limited access:</strong> {snapshot()?.processes.error}</div>
            </Show>
            <Show when={processes().length > 0} fallback={<p class="empty">No processes deployed</p>}>
              <table class="data-table">
                <thead>
                  <tr><th>Process</th><th class="priority-col">Status</th><th class="due-col">Deployed</th></tr>
                </thead>
                <tbody>
                  <For each={processes()}>
                    {(p) => (
                      <tr>
                        <td>
                          <strong>{p.displayName || p.name}</strong>
                          <code style={{ 'margin-left': '8px' }}>v{p.version}</code>
                          <Show when={p.description}>
                            <div class="task-desc">{p.description}</div>
                          </Show>
                        </td>
                        <td>
                          <span class="badge" style={{ background: p.activationState === 'ENABLED' ? '#16a085' : '#7f8c8d' }}>
                            {p.activationState}
                          </span>
                        </td>
                        <td>{new Date(p.deploymentDate).toLocaleDateString()}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </Show>
        </div>
      </div>

      <Show when={detailTask()}>
        {(t) => (
          <div class="modal-overlay" onClick={() => setDetailTask(null)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <h2>{t().displayName || t().name}</h2>
                <button class="modal-close" onClick={() => setDetailTask(null)}>×</button>
              </div>
              <div class="modal-body">
                <div class="detail-grid">
                  <div>
                    <div class="muted">Priority</div>
                    <span class="badge" style={{ background: priorityColor(t().priority) }}>{priorityLabel(t().priority)}</span>
                  </div>
                  <div><div class="muted">Status</div><div>{t().state}</div></div>
                  <div><div class="muted">Case ID</div><code>#{t().caseId}</code></div>
                  <div>
                    <div class="muted">Due date</div>
                    <div>
                      <Show when={t().dueDate} fallback={<span class="muted">No due date</span>}>
                        {fmt(t().dueDate)}
                        <Show when={isOverdue(t())}>
                          <span class="badge badge-danger" style={{ 'margin-left': '8px' }}>Overdue</span>
                        </Show>
                      </Show>
                    </div>
                  </div>
                  <Show when={t().description}>
                    <div class="span-2"><div class="muted">Description</div><div>{t().description}</div></div>
                  </Show>
                  <div class="span-2"><div class="muted">Task ID</div><code>{t().id}</code></div>
                </div>
                <div class="detail-progress">
                  <div class="muted">Time pressure</div>
                  <div class="progress-track">
                    <div class="progress-fill"
                         style={{ width: `${pressurePct(t())}%`, background: pressureColor(t()) }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
