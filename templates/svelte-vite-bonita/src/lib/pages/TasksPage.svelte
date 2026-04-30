<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth.svelte';
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

  let snapshot = $state<BpmSnapshot | null>(null);
  let loading = $state(false);
  let search = $state('');
  let priorityFilter = $state<Priority | 'all'>('all');
  let sortBy = $state<'priority' | 'dueDate' | 'name'>('priority');
  let detailTask = $state<BonitaTask | null>(null);
  let activeTab = $state<'tasks' | 'cases' | 'processes'>('tasks');

  function isOverdue(t: BonitaTask) { return !!t.dueDate && new Date(t.dueDate).getTime() < Date.now(); }
  function isDueToday(t: BonitaTask) {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate); const n = new Date();
    return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
  }
  function priorityColor(p: string) { return PRIORITY_META[p as Priority]?.color ?? '#909399'; }
  function priorityLabel(p: string) { return PRIORITY_META[p as Priority]?.label ?? p; }
  function fmt(d?: string) { return d ? new Date(d).toLocaleString() : '—'; }

  async function load() {
    if (!authStore.user) return;
    loading = true;
    try { snapshot = await loadSnapshot(authStore.user.userId); }
    finally { loading = false; }
  }

  onMount(load);

  let tasks = $derived(snapshot?.tasks.data ?? []);
  let tasksTotal = $derived(snapshot?.tasks.total ?? 0);
  let processes = $derived(snapshot?.processes.data ?? []);
  let processesTotal = $derived(snapshot?.processes.total ?? 0);
  let openCases = $derived(snapshot?.openCases.data ?? []);
  let openCasesTotal = $derived(snapshot?.openCases.total ?? 0);
  let closedToday = $derived(snapshot?.closedToday.data ?? []);
  let closedTodayTotal = $derived(snapshot?.closedToday.total ?? 0);
  let enabledProcesses = $derived(processes.filter(p => p.activationState === 'ENABLED').length);

  let stats = $derived.by(() => {
    const t = tasks;
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

  let visibleTasks = $derived.by(() => {
    const lower = search.trim().toLowerCase();
    const rank: Record<string, number> = { highest:0, above_normal:1, normal:2, under_normal:3, lowest:4 };
    return tasks.filter(t => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (!lower) return true;
      return `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase().includes(lower);
    }).slice().sort((a, b) => {
      if (sortBy === 'priority') return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (sortBy === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
  });

  let distributionEntries = $derived(PRIORITIES.map(p => ({
    priority: p, count: stats.distribution[p],
    pct: Math.round((stats.distribution[p] / Math.max(1, tasks.length)) * 100),
    color: PRIORITY_META[p].color, label: PRIORITY_META[p].label,
  })));

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
</script>

<div class="dashboard">
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#FF3E00">⬡</div>
        <div>
          <div class="kpi-title">Active processes</div>
          <div class="kpi-value">{enabledProcesses}{#if processesTotal > 0}<span class="kpi-suffix">/ {processesTotal}</span>{/if}</div>
          <div class="kpi-sub">Deployed and enabled</div>
        </div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#3498db">📁</div>
        <div>
          <div class="kpi-title">Open cases</div>
          <div class="kpi-value">{openCasesTotal >= 0 ? openCasesTotal : openCases.length}</div>
          <div class="kpi-sub">In-flight process instances</div>
        </div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#16a085">✓</div>
        <div>
          <div class="kpi-title">Closed today</div>
          <div class="kpi-value">{closedTodayTotal >= 0 ? closedTodayTotal : closedToday.length}</div>
          <div class="kpi-sub">Cases archived since 00:00</div>
        </div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#e67e22">🚀</div>
        <div>
          <div class="kpi-title">My tasks</div>
          <div class="kpi-value">{tasksTotal}</div>
          <div class="kpi-sub">Pending in my inbox</div>
        </div>
      </div>
    </div>
  </div>

  <div class="kpi-row kpi-row-secondary">
    <div class="kpi-card kpi-mini" class:kpi-warn={stats.overdue > 0}>
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#c0392b">⚠</div>
        <div>
          <div class="kpi-title">Overdue</div>
          <div class="kpi-value" style:color={stats.overdue > 0 ? '#c0392b' : ''}>{stats.overdue}</div>
        </div>
      </div>
    </div>
    <div class="kpi-card kpi-mini">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#e67e22">📅</div>
        <div><div class="kpi-title">Due today</div><div class="kpi-value">{stats.dueToday}</div></div>
      </div>
    </div>
    <div class="kpi-card kpi-mini">
      <div class="kpi-content">
        <div class="kpi-icon" style="color:#e67e22">🔥</div>
        <div><div class="kpi-title">High priority</div><div class="kpi-value">{stats.highPriority}</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h2>Task priority distribution</h2></div>
    {#if tasks.length === 0}
      <p class="empty">No tasks to chart</p>
    {:else}
      <div class="distribution-bars">
        {#each distributionEntries as e (e.priority)}
          <div class="dist-row">
            <div class="dist-label">
              <span class="priority-dot" style:background={e.color}></span>
              <span>{e.label}</span>
            </div>
            <div class="dist-bar-track">
              <div class="dist-bar-fill" style:width="{(e.count / stats.maxCount) * 100}%" style:background={e.color} title="{e.count} tasks ({e.pct}%)"></div>
            </div>
            <div class="dist-count">{e.count}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="card tabs-card">
    <div class="tabs-nav">
      <button class="tab-btn" class:active={activeTab === 'tasks'} onclick={() => activeTab = 'tasks'}>⏱ My tasks ({visibleTasks.length})</button>
      <button class="tab-btn" class:active={activeTab === 'cases'} onclick={() => activeTab = 'cases'}>📁 Open cases ({openCases.length})</button>
      <button class="tab-btn" class:active={activeTab === 'processes'} onclick={() => activeTab = 'processes'}>⬡ Processes ({processes.length})</button>
    </div>
    <div class="tab-body">
      {#if activeTab === 'tasks'}
        {#if snapshot?.tasks.error}
          <div class="alert alert-error"><strong>Failed to load tasks:</strong> {snapshot.tasks.error}</div>
        {/if}
        <div class="filters-bar">
          <input class="filter-input" type="text" placeholder="🔍  Search by name or case…" bind:value={search} />
          <select class="filter-select" bind:value={priorityFilter}>
            <option value="all">All priorities</option>
            {#each PRIORITIES as p}<option value={p}>{priorityLabel(p)}</option>{/each}
          </select>
          <select class="filter-select" bind:value={sortBy}>
            <option value="priority">By priority</option>
            <option value="dueDate">By due date</option>
            <option value="name">By name</option>
          </select>
          <button class="btn-primary" disabled={loading} onclick={load}>{loading ? 'Loading…' : '⟳ Refresh all'}</button>
        </div>
        {#if visibleTasks.length === 0}
          <p class="empty">{tasks.length === 0 ? 'No pending tasks. Enjoy the silence.' : 'No tasks match the current filters.'}</p>
        {:else}
          <table class="data-table">
            <thead><tr><th>Task</th><th class="priority-col">Priority</th><th class="case-col">Case</th><th class="due-col">Due</th><th></th></tr></thead>
            <tbody>
              {#each visibleTasks as task (task.id)}
                <tr class:row-overdue={isOverdue(task)}>
                  <td>
                    <div class="task-cell">
                      <span class="priority-dot" style:background={priorityColor(task.priority)}></span>
                      <div>
                        <div class="task-name">
                          <strong>{task.displayName || task.name}</strong>
                          {#if isOverdue(task)}<span class="badge badge-danger">Overdue</span>
                          {:else if isDueToday(task)}<span class="badge badge-warning">Today</span>{/if}
                        </div>
                        {#if task.description}<div class="task-desc">{task.description}</div>{/if}
                      </div>
                    </div>
                  </td>
                  <td><span class="badge" style:background={priorityColor(task.priority)}>{priorityLabel(task.priority)}</span></td>
                  <td><code>#{task.caseId}</code></td>
                  <td>{fmt(task.dueDate)}</td>
                  <td><button class="btn-secondary" onclick={() => detailTask = task}>Details</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {:else if activeTab === 'cases'}
        {#if snapshot?.openCases.error}<div class="alert alert-warn"><strong>Limited access:</strong> {snapshot.openCases.error}</div>{/if}
        {#if openCases.length === 0}
          <p class="empty">No open cases</p>
        {:else}
          <table class="data-table">
            <thead><tr><th class="case-col">Case</th><th class="due-col">Started</th><th>Started by</th><th>Process</th></tr></thead>
            <tbody>
              {#each openCases as c (c.id)}
                <tr><td><code>#{c.id}</code></td><td>{fmt(c.start)}</td><td>{c.started_by || '—'}</td><td><code>{c.processDefinitionId}</code></td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {:else if activeTab === 'processes'}
        {#if snapshot?.processes.error}<div class="alert alert-warn"><strong>Limited access:</strong> {snapshot.processes.error}</div>{/if}
        {#if processes.length === 0}
          <p class="empty">No processes deployed</p>
        {:else}
          <table class="data-table">
            <thead><tr><th>Process</th><th class="priority-col">Status</th><th class="due-col">Deployed</th></tr></thead>
            <tbody>
              {#each processes as p (p.id)}
                <tr>
                  <td>
                    <strong>{p.displayName || p.name}</strong>
                    <code style="margin-left:8px">v{p.version}</code>
                    {#if p.description}<div class="task-desc">{p.description}</div>{/if}
                  </td>
                  <td><span class="badge" style:background={p.activationState === 'ENABLED' ? '#16a085' : '#7f8c8d'}>{p.activationState}</span></td>
                  <td>{new Date(p.deploymentDate).toLocaleDateString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </div>
  </div>

  {#if detailTask}
    <div class="modal-overlay" onclick={() => detailTask = null} onkeydown={(e) => e.key === 'Escape' && (detailTask = null)} role="presentation">
      <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
        <div class="modal-header">
          <h2>{detailTask.displayName || detailTask.name}</h2>
          <button class="modal-close" onclick={() => detailTask = null}>×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div><div class="muted">Priority</div><span class="badge" style:background={priorityColor(detailTask.priority)}>{priorityLabel(detailTask.priority)}</span></div>
            <div><div class="muted">Status</div><div>{detailTask.state}</div></div>
            <div><div class="muted">Case ID</div><code>#{detailTask.caseId}</code></div>
            <div>
              <div class="muted">Due date</div>
              <div>
                {#if detailTask.dueDate}
                  {fmt(detailTask.dueDate)}
                  {#if isOverdue(detailTask)}<span class="badge badge-danger" style="margin-left:8px">Overdue</span>{/if}
                {:else}
                  <span class="muted">No due date</span>
                {/if}
              </div>
            </div>
            {#if detailTask.description}
              <div class="span-2"><div class="muted">Description</div><div>{detailTask.description}</div></div>
            {/if}
            <div class="span-2"><div class="muted">Task ID</div><code>{detailTask.id}</code></div>
          </div>
          <div class="detail-progress">
            <div class="muted">Time pressure</div>
            <div class="progress-track">
              <div class="progress-fill" style:width="{pressurePct(detailTask)}%" style:background={pressureColor(detailTask)}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
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
  .kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; color: #303133; }
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
</style>
