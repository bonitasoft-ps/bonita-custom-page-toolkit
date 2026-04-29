import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../stores/auth.store';
import { BpmService, type BpmSnapshot } from '../api/bpm.service';
import type { BonitaTask } from '../api/tasks.service';

const PRIORITIES = ['highest', 'above_normal', 'normal', 'under_normal', 'lowest'] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  highest:      { label: 'Highest', color: '#c0392b' },
  above_normal: { label: 'High',    color: '#e67e22' },
  normal:       { label: 'Normal',  color: '#3498db' },
  under_normal: { label: 'Low',     color: '#16a085' },
  lowest:       { label: 'Lowest',  color: '#7f8c8d' },
};

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <!-- TOP KPIs -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#dd0031">⬡</div>
            <div>
              <div class="kpi-title">Active processes</div>
              <div class="kpi-value">
                {{ enabledProcesses() }}
                <span class="kpi-suffix" *ngIf="processesTotal() > 0">/ {{ processesTotal() }}</span>
              </div>
              <div class="kpi-sub">Deployed and enabled</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#3498db">📁</div>
            <div>
              <div class="kpi-title">Open cases</div>
              <div class="kpi-value">{{ openCasesTotal() >= 0 ? openCasesTotal() : openCases().length }}</div>
              <div class="kpi-sub">In-flight process instances</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#16a085">✓</div>
            <div>
              <div class="kpi-title">Closed today</div>
              <div class="kpi-value">{{ closedTodayTotal() >= 0 ? closedTodayTotal() : closedToday().length }}</div>
              <div class="kpi-sub">Cases archived since 00:00</div>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#e67e22">🚀</div>
            <div>
              <div class="kpi-title">My tasks</div>
              <div class="kpi-value">{{ tasksTotal() }}</div>
              <div class="kpi-sub">Pending in my inbox</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECONDARY KPIs -->
      <div class="kpi-row kpi-row-secondary">
        <div class="kpi-card kpi-mini" [class.kpi-warn]="stats().overdue > 0">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#c0392b">⚠</div>
            <div>
              <div class="kpi-title">Overdue</div>
              <div class="kpi-value" [style.color]="stats().overdue > 0 ? '#c0392b' : null">
                {{ stats().overdue }}
              </div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-mini">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#e67e22">📅</div>
            <div>
              <div class="kpi-title">Due today</div>
              <div class="kpi-value">{{ stats().dueToday }}</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-mini">
          <div class="kpi-content">
            <div class="kpi-icon" style="color:#e67e22">🔥</div>
            <div>
              <div class="kpi-title">High priority</div>
              <div class="kpi-value">{{ stats().highPriority }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DISTRIBUTION CHART -->
      <div class="card distribution-card">
        <div class="card-header">
          <h2>Task priority distribution</h2>
        </div>
        @if (tasks().length === 0) {
          <p class="empty">No tasks to chart</p>
        } @else {
          <div class="distribution-bars">
            @for (e of distributionEntries(); track e.priority) {
              <div class="dist-row">
                <div class="dist-label">
                  <span class="priority-dot" [style.background]="e.color"></span>
                  <span>{{ e.label }}</span>
                </div>
                <div class="dist-bar-track">
                  <div class="dist-bar-fill"
                       [style.width.%]="(e.count / stats().maxCount) * 100"
                       [style.background]="e.color"
                       [title]="e.count + ' tasks (' + e.pct + '%)'"></div>
                </div>
                <div class="dist-count">{{ e.count }}</div>
              </div>
            }
          </div>
        }
      </div>

      <!-- TABS -->
      <div class="card tabs-card">
        <div class="tabs-nav">
          <button class="tab-btn" [class.active]="activeTab() === 'tasks'" (click)="activeTab.set('tasks')">
            ⏱ My tasks ({{ visibleTasks().length }})
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'cases'" (click)="activeTab.set('cases')">
            📁 Open cases ({{ openCases().length }})
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'processes'" (click)="activeTab.set('processes')">
            ⬡ Processes ({{ processes().length }})
          </button>
        </div>

        <div class="tab-body">
          @if (activeTab() === 'tasks') {
            @if (snapshot()?.tasks?.error; as err) {
              <div class="alert alert-error"><strong>Failed to load tasks:</strong> {{ err }}</div>
            }
            <div class="filters-bar">
              <input type="text" class="filter-input" placeholder="🔍  Search by name or case…"
                     [ngModel]="search()" (ngModelChange)="search.set($event)" />
              <select class="filter-select"
                      [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event)">
                <option value="all">All priorities</option>
                @for (p of priorities; track p) {
                  <option [value]="p">{{ priorityLabel(p) }}</option>
                }
              </select>
              <select class="filter-select"
                      [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
                <option value="priority">By priority</option>
                <option value="dueDate">By due date</option>
                <option value="name">By name</option>
              </select>
              <button class="btn-primary" [disabled]="loading()" (click)="load()">
                {{ loading() ? 'Loading…' : '⟳ Refresh all' }}
              </button>
            </div>

            @if (visibleTasks().length === 0) {
              <p class="empty">
                {{ tasks().length === 0
                    ? 'No pending tasks. Enjoy the silence.'
                    : 'No tasks match the current filters.' }}
              </p>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th class="priority-col">Priority</th>
                    <th class="case-col">Case</th>
                    <th class="due-col">Due</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (task of visibleTasks(); track task.id) {
                    <tr [class.row-overdue]="isOverdue(task)">
                      <td>
                        <div class="task-cell">
                          <span class="priority-dot" [style.background]="priorityColor(task.priority)"></span>
                          <div>
                            <div class="task-name">
                              <strong>{{ task.displayName || task.name }}</strong>
                              @if (isOverdue(task)) {
                                <span class="badge badge-danger">Overdue</span>
                              } @else if (isDueToday(task)) {
                                <span class="badge badge-warning">Today</span>
                              }
                            </div>
                            @if (task.description) {
                              <div class="task-desc">{{ task.description }}</div>
                            }
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="badge" [style.background]="priorityColor(task.priority)">
                          {{ priorityLabel(task.priority) }}
                        </span>
                      </td>
                      <td><code>#{{ task.caseId }}</code></td>
                      <td>{{ formatDate(task.dueDate) }}</td>
                      <td>
                        <button class="btn-secondary" (click)="detailTask.set(task)">Details</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }

          @if (activeTab() === 'cases') {
            @if (snapshot()?.openCases?.error; as err) {
              <div class="alert alert-warn"><strong>Limited access:</strong> {{ err }}</div>
            }
            @if (openCases().length === 0) {
              <p class="empty">No open cases</p>
            } @else {
              <table class="data-table">
                <thead>
                  <tr><th class="case-col">Case</th><th class="due-col">Started</th><th>Started by</th><th>Process</th></tr>
                </thead>
                <tbody>
                  @for (c of openCases(); track c.id) {
                    <tr>
                      <td><code>#{{ c.id }}</code></td>
                      <td>{{ formatDate(c.start) }}</td>
                      <td>{{ c.started_by || '—' }}</td>
                      <td><code>{{ c.processDefinitionId }}</code></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }

          @if (activeTab() === 'processes') {
            @if (snapshot()?.processes?.error; as err) {
              <div class="alert alert-warn"><strong>Limited access:</strong> {{ err }}</div>
            }
            @if (processes().length === 0) {
              <p class="empty">No processes deployed</p>
            } @else {
              <table class="data-table">
                <thead>
                  <tr><th>Process</th><th class="priority-col">Status</th><th class="due-col">Deployed</th></tr>
                </thead>
                <tbody>
                  @for (p of processes(); track p.id) {
                    <tr>
                      <td>
                        <strong>{{ p.displayName || p.name }}</strong>
                        <code style="margin-left:8px">v{{ p.version }}</code>
                        @if (p.description) { <div class="task-desc">{{ p.description }}</div> }
                      </td>
                      <td>
                        <span class="badge"
                              [style.background]="p.activationState === 'ENABLED' ? '#16a085' : '#7f8c8d'">
                          {{ p.activationState }}
                        </span>
                      </td>
                      <td>{{ formatShortDate(p.deploymentDate) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>
      </div>

      @if (detailTask(); as t) {
        <div class="modal-overlay" (click)="detailTask.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ t.displayName || t.name }}</h2>
              <button class="modal-close" (click)="detailTask.set(null)">×</button>
            </div>
            <div class="modal-body">
              <div class="detail-grid">
                <div>
                  <div class="muted">Priority</div>
                  <span class="badge" [style.background]="priorityColor(t.priority)">{{ priorityLabel(t.priority) }}</span>
                </div>
                <div><div class="muted">Status</div><div>{{ t.state }}</div></div>
                <div><div class="muted">Case ID</div><code>#{{ t.caseId }}</code></div>
                <div>
                  <div class="muted">Due date</div>
                  <div>
                    @if (t.dueDate) {
                      {{ formatDate(t.dueDate) }}
                      @if (isOverdue(t)) { <span class="badge badge-danger" style="margin-left:8px">Overdue</span> }
                    } @else {
                      <span class="muted">No due date</span>
                    }
                  </div>
                </div>
                @if (t.description) {
                  <div class="span-2"><div class="muted">Description</div><div>{{ t.description }}</div></div>
                }
                <div class="span-2"><div class="muted">Task ID</div><code>{{ t.id }}</code></div>
              </div>
              <div class="detail-progress">
                <div class="muted">Time pressure</div>
                <div class="progress-track">
                  <div class="progress-fill"
                       [style.width.%]="pressurePct(t)"
                       [style.background]="pressureColor(t)"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
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
  `],
})
export class TasksPage implements OnInit {
  private store = inject(AuthStore);
  private bpm = inject(BpmService);

  snapshot = signal<BpmSnapshot | null>(null);
  loading = signal(false);

  search = signal('');
  priorityFilter = signal<Priority | 'all'>('all');
  sortBy = signal<'priority' | 'dueDate' | 'name'>('priority');
  detailTask = signal<BonitaTask | null>(null);
  activeTab = signal<'tasks' | 'cases' | 'processes'>('tasks');

  priorities = PRIORITIES;

  tasks = computed(() => this.snapshot()?.tasks.data ?? []);
  tasksTotal = computed(() => this.snapshot()?.tasks.total ?? 0);
  processes = computed(() => this.snapshot()?.processes.data ?? []);
  processesTotal = computed(() => this.snapshot()?.processes.total ?? 0);
  openCases = computed(() => this.snapshot()?.openCases.data ?? []);
  openCasesTotal = computed(() => this.snapshot()?.openCases.total ?? 0);
  closedToday = computed(() => this.snapshot()?.closedToday.data ?? []);
  closedTodayTotal = computed(() => this.snapshot()?.closedToday.total ?? 0);

  enabledProcesses = computed(() =>
    this.processes().filter((p) => p.activationState === 'ENABLED').length
  );

  stats = computed(() => {
    const t = this.tasks();
    const overdue = t.filter((x) => this.isOverdue(x)).length;
    const dueToday = t.filter((x) => this.isDueToday(x)).length;
    const highPriority = t.filter(
      (x) => x.priority === 'highest' || x.priority === 'above_normal'
    ).length;
    const distribution: Record<Priority, number> = {
      highest: 0, above_normal: 0, normal: 0, under_normal: 0, lowest: 0,
    };
    for (const x of t) {
      const p = (PRIORITIES.includes(x.priority as Priority) ? x.priority : 'normal') as Priority;
      distribution[p]++;
    }
    const maxCount = Math.max(1, ...Object.values(distribution));
    return { overdue, dueToday, highPriority, distribution, maxCount };
  });

  visibleTasks = computed(() => {
    const lower = this.search().trim().toLowerCase();
    const rank: Record<string, number> = {
      highest: 0, above_normal: 1, normal: 2, under_normal: 3, lowest: 4,
    };
    return this.tasks()
      .filter((t) => {
        if (this.priorityFilter() !== 'all' && t.priority !== this.priorityFilter()) return false;
        if (!lower) return true;
        return `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase().includes(lower);
      })
      .slice()
      .sort((a, b) => {
        if (this.sortBy() === 'priority') {
          return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
        }
        if (this.sortBy() === 'dueDate') {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return da - db;
        }
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
      });
  });

  distributionEntries = computed(() => {
    const s = this.stats();
    const total = Math.max(1, this.tasks().length);
    return PRIORITIES.map((p) => ({
      priority: p,
      count: s.distribution[p],
      pct: Math.round((s.distribution[p] / total) * 100),
      color: PRIORITY_META[p].color,
      label: PRIORITY_META[p].label,
    }));
  });

  ngOnInit() { this.load(); }

  async load() {
    const id = this.store.user()?.userId;
    if (!id) return;
    this.loading.set(true);
    try {
      const snap = await firstValueFrom(this.bpm.loadSnapshot(id));
      this.snapshot.set(snap);
    } finally {
      this.loading.set(false);
    }
  }

  isOverdue(t: BonitaTask): boolean {
    return !!t.dueDate && new Date(t.dueDate).getTime() < Date.now();
  }
  isDueToday(t: BonitaTask): boolean {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate); const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  priorityColor(p: string): string { return PRIORITY_META[p as Priority]?.color ?? '#909399'; }
  priorityLabel(p: string): string { return PRIORITY_META[p as Priority]?.label ?? p; }
  formatDate(d?: string): string { return d ? new Date(d).toLocaleString() : '—'; }
  formatShortDate(d: string): string { return new Date(d).toLocaleDateString(); }
  pressurePct(t: BonitaTask): number {
    if (this.isOverdue(t)) return 100;
    if (this.isDueToday(t)) return 80;
    if (t.dueDate) return 40;
    return 10;
  }
  pressureColor(t: BonitaTask): string {
    if (this.isOverdue(t)) return '#c0392b';
    if (this.isDueToday(t)) return '#e67e22';
    return '#3498db';
  }
}
