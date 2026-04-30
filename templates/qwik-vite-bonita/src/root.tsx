import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  useStyles$,
  useComputed$,
  type Signal,
} from '@builder.io/qwik';
import { setSessionExpiredHandler } from './api/client';
import { login, getSession, logout as apiLogout } from './api/auth';
import {
  loadSnapshot, type BpmSnapshot, type BonitaTask, type BonitaProcess, type BonitaCase,
} from './api/bpm';

interface AuthUser { userId: string; userName: string; displayName: string; }
interface AuthState { user: AuthUser | null; booted: boolean; }

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

// MODULE-LEVEL helper — Qwik resolves this by module path across lazy chunks
async function fetchBpmSnapshot(
  userId: string,
  out: { snapshot: Signal<BpmSnapshot | null>; loading: Signal<boolean> }
): Promise<void> {
  out.loading.value = true;
  try {
    out.snapshot.value = await loadSnapshot(userId);
  } finally {
    out.loading.value = false;
  }
}

function pressurePct(t: BonitaTask) {
  if (isOverdue(t)) return 100;
  if (isDueToday(t)) return 80;
  if (t.dueDate) return 40;
  return 10;
}
function pressureColor(t: BonitaTask) {
  if (isOverdue(t)) return '#c0392b';
  if (isDueToday(t)) return '#e67e22';
  return '#3498db';
}

export default component$(() => {
  useStyles$(STYLES);

  const auth = useStore<AuthState>({ user: null, booted: false });
  const route = useSignal<'login' | 'home'>('login');

  const username = useSignal('');
  const password = useSignal('');
  const loginLoading = useSignal(false);
  const loginError = useSignal<string | null>(null);

  const snapshot = useSignal<BpmSnapshot | null>(null);
  const loading = useSignal(false);
  const search = useSignal('');
  const priorityFilter = useSignal<Priority | 'all'>('all');
  const sortBy = useSignal<'priority' | 'dueDate' | 'name'>('priority');
  const detailTask = useSignal<BonitaTask | null>(null);
  const activeTab = useSignal<'tasks' | 'cases' | 'processes'>('tasks');

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    setSessionExpiredHandler(() => { auth.user = null; route.value = 'login'; });
    try {
      const s = await getSession();
      auth.user = { userId: s.user_id, userName: s.user_name, displayName: s.user_name };
      route.value = 'home';
      await fetchBpmSnapshot(s.user_id, { snapshot, loading });
    } catch {
      auth.user = null;
      route.value = 'login';
    } finally {
      auth.booted = true;
    }
  });

  const tasks = useComputed$(() => snapshot.value?.tasks.data ?? []);
  const tasksTotal = useComputed$(() => snapshot.value?.tasks.total ?? 0);
  const processes = useComputed$(() => snapshot.value?.processes.data ?? []);
  const processesTotal = useComputed$(() => snapshot.value?.processes.total ?? 0);
  const openCases = useComputed$(() => snapshot.value?.openCases.data ?? []);
  const openCasesTotal = useComputed$(() => snapshot.value?.openCases.total ?? 0);
  const closedToday = useComputed$(() => snapshot.value?.closedToday.data ?? []);
  const closedTodayTotal = useComputed$(() => snapshot.value?.closedToday.total ?? 0);
  const enabledProcesses = useComputed$(() =>
    processes.value.filter((p) => p.activationState === 'ENABLED').length
  );

  const stats = useComputed$(() => {
    const t = tasks.value;
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

  const visibleTasks = useComputed$(() => {
    const lower = search.value.trim().toLowerCase();
    const rank: Record<string, number> = { highest:0, above_normal:1, normal:2, under_normal:3, lowest:4 };
    return tasks.value.filter(t => {
      if (priorityFilter.value !== 'all' && t.priority !== priorityFilter.value) return false;
      if (!lower) return true;
      return `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase().includes(lower);
    }).slice().sort((a, b) => {
      if (sortBy.value === 'priority') return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (sortBy.value === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
  });

  const distributionEntries = useComputed$(() => {
    const s = stats.value;
    const total = Math.max(1, tasks.value.length);
    return PRIORITIES.map(p => ({
      priority: p, count: s.distribution[p],
      pct: Math.round((s.distribution[p] / total) * 100),
      color: PRIORITY_META[p].color, label: PRIORITY_META[p].label,
    }));
  });

  if (!auth.booted) {
    return <div class="booting">Loading…</div>;
  }

  if (route.value === 'login' || !auth.user) {
    return (
      <div class="wrapper">
        <form
          class="login-card"
          preventdefault:submit
          onSubmit$={async () => {
            if (!username.value || !password.value) return;
            loginLoading.value = true;
            loginError.value = null;
            try {
              await login(username.value, password.value);
              const s = await getSession();
              auth.user = { userId: s.user_id, userName: s.user_name, displayName: s.user_name };
              route.value = 'home';
              await fetchBpmSnapshot(s.user_id, { snapshot, loading });
            } catch {
              loginError.value = 'Invalid credentials';
            } finally {
              loginLoading.value = false;
            }
          }}
        >
          <h1>Sign in</h1>
          <input type="text" placeholder="Username" autoComplete="username"
                 value={username.value} onInput$={(_, el) => (username.value = el.value)} required />
          <input type="password" placeholder="Password" autoComplete="current-password"
                 value={password.value} onInput$={(_, el) => (password.value = el.value)} required />
          {loginError.value && <p class="error">{loginError.value}</p>}
          <button type="submit" disabled={loginLoading.value}>
            {loginLoading.value ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  const onLogout$ = async () => {
    try { await apiLogout(); } finally {
      auth.user = null;
      route.value = 'login';
      snapshot.value = null;
    }
  };

  const onRefresh$ = async () => {
    if (auth.user) await fetchBpmSnapshot(auth.user.userId, { snapshot, loading });
  };

  return (
    <div class="layout">
      <header class="topbar">
        <h1>__DISPLAY_NAME__</h1>
        <div class="actions">
          <span class="user">{auth.user.displayName}</span>
          <button class="logout" onClick$={onLogout$}>Logout</button>
        </div>
      </header>
      <main class="content">
        <div class="dashboard">
          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#18B6F6' }}>⬡</div>
                <div>
                  <div class="kpi-title">Active processes</div>
                  <div class="kpi-value">
                    {enabledProcesses.value}
                    {processesTotal.value > 0 && <span class="kpi-suffix">/ {processesTotal.value}</span>}
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
                  <div class="kpi-value">{openCasesTotal.value >= 0 ? openCasesTotal.value : openCases.value.length}</div>
                  <div class="kpi-sub">In-flight process instances</div>
                </div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#16a085' }}>✓</div>
                <div>
                  <div class="kpi-title">Closed today</div>
                  <div class="kpi-value">{closedTodayTotal.value >= 0 ? closedTodayTotal.value : closedToday.value.length}</div>
                  <div class="kpi-sub">Cases archived since 00:00</div>
                </div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#e67e22' }}>🚀</div>
                <div>
                  <div class="kpi-title">My tasks</div>
                  <div class="kpi-value">{tasksTotal.value}</div>
                  <div class="kpi-sub">Pending in my inbox</div>
                </div>
              </div>
            </div>
          </div>

          <div class="kpi-row kpi-row-secondary">
            <div class={`kpi-card kpi-mini ${stats.value.overdue > 0 ? 'kpi-warn' : ''}`}>
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#c0392b' }}>⚠</div>
                <div>
                  <div class="kpi-title">Overdue</div>
                  <div class="kpi-value" style={{ color: stats.value.overdue > 0 ? '#c0392b' : undefined }}>
                    {stats.value.overdue}
                  </div>
                </div>
              </div>
            </div>
            <div class="kpi-card kpi-mini">
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#e67e22' }}>📅</div>
                <div><div class="kpi-title">Due today</div><div class="kpi-value">{stats.value.dueToday}</div></div>
              </div>
            </div>
            <div class="kpi-card kpi-mini">
              <div class="kpi-content">
                <div class="kpi-icon" style={{ color: '#e67e22' }}>🔥</div>
                <div><div class="kpi-title">High priority</div><div class="kpi-value">{stats.value.highPriority}</div></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h2>Task priority distribution</h2></div>
            {tasks.value.length === 0 ? (
              <p class="empty">No tasks to chart</p>
            ) : (
              <div class="distribution-bars">
                {distributionEntries.value.map((e) => (
                  <div class="dist-row" key={e.priority}>
                    <div class="dist-label">
                      <span class="priority-dot" style={{ background: e.color }} />
                      <span>{e.label}</span>
                    </div>
                    <div class="dist-bar-track">
                      <div class="dist-bar-fill"
                           style={{ width: `${(e.count / stats.value.maxCount) * 100}%`, background: e.color }}
                           title={`${e.count} tasks (${e.pct}%)`} />
                    </div>
                    <div class="dist-count">{e.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div class="card tabs-card">
            <div class="tabs-nav">
              <button class={`tab-btn ${activeTab.value === 'tasks' ? 'active' : ''}`} onClick$={() => activeTab.value = 'tasks'}>
                ⏱ My tasks ({visibleTasks.value.length})
              </button>
              <button class={`tab-btn ${activeTab.value === 'cases' ? 'active' : ''}`} onClick$={() => activeTab.value = 'cases'}>
                📁 Open cases ({openCases.value.length})
              </button>
              <button class={`tab-btn ${activeTab.value === 'processes' ? 'active' : ''}`} onClick$={() => activeTab.value = 'processes'}>
                ⬡ Processes ({processes.value.length})
              </button>
            </div>
            <div class="tab-body">
              {activeTab.value === 'tasks' && (
                <>
                  {snapshot.value?.tasks.error && (
                    <div class="alert alert-error"><strong>Failed to load tasks:</strong> {snapshot.value.tasks.error}</div>
                  )}
                  <div class="filters-bar">
                    <input class="filter-input" type="text" placeholder="🔍  Search by name or case…"
                           value={search.value} onInput$={(_, el) => (search.value = el.value)} />
                    <select class="filter-select" value={priorityFilter.value}
                            onChange$={(_, el) => (priorityFilter.value = el.value as Priority | 'all')}>
                      <option value="all">All priorities</option>
                      {PRIORITIES.map((p) => <option value={p} key={p}>{priorityLabel(p)}</option>)}
                    </select>
                    <select class="filter-select" value={sortBy.value}
                            onChange$={(_, el) => (sortBy.value = el.value as 'priority' | 'dueDate' | 'name')}>
                      <option value="priority">By priority</option>
                      <option value="dueDate">By due date</option>
                      <option value="name">By name</option>
                    </select>
                    <button class="btn-primary" disabled={loading.value} onClick$={onRefresh$}>
                      {loading.value ? 'Loading…' : '⟳ Refresh all'}
                    </button>
                  </div>
                  {visibleTasks.value.length === 0 ? (
                    <p class="empty">
                      {tasks.value.length === 0
                        ? 'No pending tasks. Enjoy the silence.'
                        : 'No tasks match the current filters.'}
                    </p>
                  ) : (
                    <table class="data-table">
                      <thead>
                        <tr><th>Task</th><th class="priority-col">Priority</th><th class="case-col">Case</th><th class="due-col">Due</th><th></th></tr>
                      </thead>
                      <tbody>
                        {visibleTasks.value.map((task) => (
                          <tr key={task.id} class={isOverdue(task) ? 'row-overdue' : ''}>
                            <td>
                              <div class="task-cell">
                                <span class="priority-dot" style={{ background: priorityColor(task.priority) }} />
                                <div>
                                  <div class="task-name">
                                    <strong>{task.displayName || task.name}</strong>
                                    {isOverdue(task) && <span class="badge badge-danger">Overdue</span>}
                                    {!isOverdue(task) && isDueToday(task) && <span class="badge badge-warning">Today</span>}
                                  </div>
                                  {task.description && <div class="task-desc">{task.description}</div>}
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
                            <td><button class="btn-secondary" onClick$={() => detailTask.value = task}>Details</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeTab.value === 'cases' && (
                <>
                  {snapshot.value?.openCases.error && (
                    <div class="alert alert-warn"><strong>Limited access:</strong> {snapshot.value.openCases.error}</div>
                  )}
                  {openCases.value.length === 0 ? (
                    <p class="empty">No open cases</p>
                  ) : (
                    <table class="data-table">
                      <thead><tr><th class="case-col">Case</th><th class="due-col">Started</th><th>Started by</th><th>Process</th></tr></thead>
                      <tbody>
                        {openCases.value.map((c: BonitaCase) => (
                          <tr key={c.id}>
                            <td><code>#{c.id}</code></td>
                            <td>{fmt(c.start)}</td>
                            <td>{c.started_by || '—'}</td>
                            <td><code>{c.processDefinitionId}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeTab.value === 'processes' && (
                <>
                  {snapshot.value?.processes.error && (
                    <div class="alert alert-warn"><strong>Limited access:</strong> {snapshot.value.processes.error}</div>
                  )}
                  {processes.value.length === 0 ? (
                    <p class="empty">No processes deployed</p>
                  ) : (
                    <table class="data-table">
                      <thead><tr><th>Process</th><th class="priority-col">Status</th><th class="due-col">Deployed</th></tr></thead>
                      <tbody>
                        {processes.value.map((p: BonitaProcess) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.displayName || p.name}</strong>
                              <code style={{ marginLeft: '8px' }}>v{p.version}</code>
                              {p.description && <div class="task-desc">{p.description}</div>}
                            </td>
                            <td>
                              <span class="badge" style={{ background: p.activationState === 'ENABLED' ? '#16a085' : '#7f8c8d' }}>
                                {p.activationState}
                              </span>
                            </td>
                            <td>{new Date(p.deploymentDate).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {detailTask.value && (
        <div class="modal-overlay" onClick$={() => detailTask.value = null}>
          <div class="modal" onClick$={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>{detailTask.value.displayName || detailTask.value.name}</h2>
              <button class="modal-close" onClick$={() => detailTask.value = null}>×</button>
            </div>
            <div class="modal-body">
              <div class="detail-grid">
                <div><div class="muted">Priority</div>
                  <span class="badge" style={{ background: priorityColor(detailTask.value.priority) }}>
                    {priorityLabel(detailTask.value.priority)}
                  </span>
                </div>
                <div><div class="muted">Status</div><div>{detailTask.value.state}</div></div>
                <div><div class="muted">Case ID</div><code>#{detailTask.value.caseId}</code></div>
                <div>
                  <div class="muted">Due date</div>
                  <div>
                    {detailTask.value.dueDate ? (
                      <>
                        {fmt(detailTask.value.dueDate)}
                        {isOverdue(detailTask.value) && (
                          <span class="badge badge-danger" style={{ marginLeft: '8px' }}>Overdue</span>
                        )}
                      </>
                    ) : <span class="muted">No due date</span>}
                  </div>
                </div>
                {detailTask.value.description && (
                  <div class="span-2"><div class="muted">Description</div><div>{detailTask.value.description}</div></div>
                )}
                <div class="span-2"><div class="muted">Task ID</div><code>{detailTask.value.id}</code></div>
              </div>
              <div class="detail-progress">
                <div class="muted">Time pressure</div>
                <div class="progress-track">
                  <div class="progress-fill"
                       style={{ width: `${pressurePct(detailTask.value)}%`, background: pressureColor(detailTask.value) }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const STYLES = `
.booting { display:flex; justify-content:center; align-items:center; min-height:100dvh; color:#909399; }
.wrapper { display:flex; justify-content:center; align-items:center; min-height:100dvh; background: var(--color-bg); }
.login-card { width:320px; padding:32px; background:white; border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:12px; }
.login-card h1 { margin:0 0 8px; text-align:center; font-size: 22px; }
.login-card input { padding:10px 12px; border:1px solid var(--color-border); border-radius:4px; font:inherit; }
.login-card input:focus { outline:2px solid var(--color-primary); outline-offset:-1px; }
.login-card button { padding:10px; background: var(--color-primary); color:white; border:none; border-radius:4px; }
.login-card .error { color:#c00; margin:0; font-size:14px; }
.layout { min-height:100dvh; display:flex; flex-direction:column; }
.topbar { background: linear-gradient(90deg, #18B6F6, #006CE9); color:white; display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:64px; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.layout h1 { margin:0; font-size:20px; font-weight:600; }
.actions { display:flex; align-items:center; gap:16px; }
.user { color: rgba(255, 255, 255, 0.85); }
.logout { background:transparent; color:white; border:1px solid rgba(255,255,255,0.5); padding:6px 16px; border-radius:4px; }
.logout:hover { background: rgba(255,255,255,0.1); }
.content { flex:1; padding:24px; max-width: 1280px; width: 100%; margin: 0 auto; }
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi-row-secondary { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .kpi-row-secondary { grid-template-columns: 1fr; }
}
.kpi-card { background: white; border: 1px solid var(--color-border); border-radius: 10px; padding: 20px; transition: transform .12s, box-shadow .12s; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,.06); }
.kpi-card.kpi-warn { border-color: #f6c948; background: linear-gradient(180deg, #fff8e1, white); }
.kpi-card.kpi-mini { padding: 16px 20px; }
.kpi-content { display: flex; align-items: flex-start; gap: 14px; }
.kpi-icon { font-size: 22px; padding: 10px; background: #f4f4f7; border-radius: 8px; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; }
.kpi-title { font-size: 13px; color: #909399; margin-bottom: 4px; }
.kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; color: var(--color-text); }
.kpi-suffix { font-size: 14px; color: #909399; margin-left: 4px; font-weight: 400; }
.kpi-sub { font-size: 12px; color: #909399; margin-top: 4px; }
.card { background: white; border: 1px solid var(--color-border); border-radius: 10px; padding: 24px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.card-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
.distribution-bars { display: flex; flex-direction: column; gap: 10px; }
.dist-row { display: grid; grid-template-columns: 110px 1fr 32px; align-items: center; gap: 12px; }
.dist-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #606266; }
.priority-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dist-bar-track { height: 16px; background: #f4f4f7; border-radius: 8px; overflow: hidden; }
.dist-bar-fill { height: 100%; border-radius: 8px; transition: width .4s ease-out; min-width: 2px; }
.dist-count { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
.tabs-nav { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin: -24px -24px 16px -24px; padding: 0 24px; }
.tab-btn { background: transparent; border: none; padding: 14px 16px; font: inherit; color: #606266; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.tab-btn:hover { color: var(--color-primary); }
.tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.filters-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.filter-input, .filter-select { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; background: white; }
.filter-input { width: 240px; }
.filter-input:focus, .filter-select:focus { outline: none; border-color: var(--color-primary); }
.btn-primary { padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 5px 12px; background: white; color: #606266; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-secondary:hover { color: var(--color-primary); border-color: var(--color-primary); }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 11px 12px; text-align: left; border-bottom: 1px solid var(--color-border); }
.data-table th { font-weight: 600; font-size: 12px; color: #606266; background: #fafafa; text-transform: uppercase; letter-spacing: .3px; }
.data-table tr:hover td { background: #fafbfc; }
.data-table tr.row-overdue td { background: #fff5f4; }
.data-table tr.row-overdue:hover td { background: #ffece9; }
.priority-col { width: 130px; }
.case-col { width: 100px; }
.due-col { width: 180px; }
.task-cell { display: flex; align-items: flex-start; gap: 10px; }
.task-cell .priority-dot { margin-top: 6px; }
.task-name { font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-desc { font-size: 12px; color: #909399; margin-top: 2px; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; color: white; font-size: 12px; font-weight: 500; background: #909399; }
.badge-danger { background: #c0392b; }
.badge-warning { background: #e67e22; }
.alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
.alert-error { background: #fff1f0; border-left: 4px solid #c00; color: #c00; }
.alert-warn  { background: #fff8e1; border-left: 4px solid #f6c948; color: #8b6914; }
.empty { color: #909399; padding: 32px; text-align: center; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; border-radius: 10px; width: 520px; max-width: 90vw; max-height: 85vh; overflow: auto; box-shadow: 0 12px 48px rgba(0,0,0,.2); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.modal-header h2 { margin: 0; font-size: 18px; }
.modal-close { background: transparent; border: none; font-size: 24px; cursor: pointer; color: #909399; padding: 0 8px; line-height: 1; }
.modal-body { padding: 20px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.detail-grid .span-2 { grid-column: span 2; }
.muted { font-size: 12px; color: #909399; margin-bottom: 4px; }
.detail-progress { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }
.progress-track { height: 8px; background: #f4f4f7; border-radius: 4px; overflow: hidden; margin-top: 8px; }
.progress-fill { height: 100%; transition: width .4s ease-out; }
code { background: #f4f4f7; padding: 1px 6px; border-radius: 3px; font-size: 13px; font-family: Consolas, Monaco, monospace; }
`;
