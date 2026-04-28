import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../stores/auth.store';
import { TasksService, BonitaTask } from '../api/tasks.service';

const PRIORITY_COLOR: Record<string, string> = {
  highest: '#c0392b',
  above_normal: '#e67e22',
  normal: '#3498db',
  under_normal: '#16a085',
  lowest: '#7f8c8d',
};

@Component({
  selector: 'app-tasks',
  standalone: true,
  template: `
    <div class="card">
      <header class="card-header">
        <h2>
          My pending tasks
          <span class="count">({{ total() }} total)</span>
        </h2>
        <button class="refresh" [disabled]="loading()" (click)="load()">
          {{ loading() ? 'Loading...' : 'Refresh' }}
        </button>
      </header>

      @if (error()) {
        <div class="error">
          <strong>Error</strong>
          <pre>{{ error() }}</pre>
        </div>
      }

      @if (loading()) {
        <p class="empty">Loading…</p>
      } @else if (tasks().length === 0) {
        <p class="empty">No pending tasks for {{ store.user()?.userName }}.</p>
      } @else {
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
            @for (task of tasks(); track task.id) {
              <tr>
                <td>{{ task.displayName || task.name }}</td>
                <td>
                  <span class="badge" [style.background]="priorityColor(task.priority)">
                    {{ task.priority }}
                  </span>
                </td>
                <td>{{ task.caseId }}</td>
                <td>{{ formatDate(task.dueDate) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      <details class="diag">
        <summary>Diagnostic info</summary>
        <pre>userId: {{ store.user()?.userId ?? '(not authenticated)' }}
userName: {{ store.user()?.userName ?? '—' }}
last URL: {{ lastUrl() ?? '—' }}
last status: {{ lastStatus() ?? '—' }}
result count: {{ tasks().length }} (total: {{ total() }})</pre>
      </details>
    </div>
  `,
  styles: [`
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .count { color: #909399; font-weight: 400; margin-left: 8px; font-size: 14px; }
    .refresh {
      padding: 8px 16px;
      background: var(--color-primary, #dd0031);
      color: white;
      border: none;
      border-radius: 4px;
    }
    .error {
      background: #fff1f0;
      border-left: 4px solid #c00;
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 0 4px 4px 0;
    }
    .error pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      color: #c00;
    }
    .empty { color: #909399; padding: 24px; text-align: center; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border, #e4e7ed); }
    th { font-weight: 600; font-size: 13px; color: #606266; background: #fafafa; }
    .priority-col { width: 140px; }
    .case-col { width: 120px; }
    .due-col { width: 200px; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 10px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }
    .diag {
      margin-top: 24px;
      font-size: 12px;
      color: #606266;
      border-top: 1px dashed var(--color-border, #e4e7ed);
      padding-top: 12px;
    }
    .diag summary { cursor: pointer; user-select: none; }
    .diag pre {
      margin: 8px 0 0;
      background: #fafafa;
      padding: 8px 12px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `],
})
export class TasksPage implements OnInit {
  store = inject(AuthStore);
  private tasksService = inject(TasksService);

  tasks = signal<BonitaTask[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);
  lastUrl = signal<string | null>(null);
  lastStatus = signal<string | null>(null);

  private userId = computed(() => this.store.user()?.userId);

  ngOnInit() {
    // APP_INITIALIZER guarantees the session is resolved by the time any
    // component mounts, so userId() should be set here.
    this.load();
  }

  async load() {
    const id = this.userId();
    if (!id) {
      this.error.set('No authenticated user — session probe did not return a user id.');
      this.lastStatus.set('skipped (no user)');
      return;
    }

    // Mirror the URL the service builds, for the Diagnostic panel
    const dbgParams = new URLSearchParams();
    dbgParams.set('p', '0');
    dbgParams.set('c', '50');
    dbgParams.append('f', 'state=ready');
    dbgParams.append('f', `user_id=${id}`);
    dbgParams.append('o', 'priority DESC');
    dbgParams.append('o', 'dueDate ASC');
    this.lastUrl.set(`/bonita/API/bpm/humanTask?${dbgParams}`);

    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, total } = await firstValueFrom(
        this.tasksService.getMyPendingTasks(id, 0, 50)
      );
      this.tasks.set(data);
      this.total.set(total);
      this.lastStatus.set(`200 OK — ${data.length} tasks${total >= 0 ? ` (total ${total})` : ''}`);
    } catch (e) {
      this.handleError(e);
    } finally {
      this.loading.set(false);
    }
  }

  private handleError(e: unknown): void {
    if (e instanceof HttpErrorResponse) {
      const bodySnippet =
        typeof e.error === 'string'
          ? e.error.slice(0, 500)
          : e.error
            ? JSON.stringify(e.error).slice(0, 500)
            : '';
      this.lastStatus.set(`HTTP ${e.status} ${e.statusText}`);
      this.error.set(`${e.status} ${e.statusText}\nURL: ${e.url}\n${bodySnippet}`);
      console.error('[TasksPage] HTTP error:', e);
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      this.lastStatus.set('error');
      this.error.set(msg);
      console.error('[TasksPage] Error:', e);
    }
  }

  priorityColor(p: string): string {
    return PRIORITY_COLOR[p] ?? '#909399';
  }

  formatDate(d?: string): string {
    return d ? new Date(d).toLocaleString() : '—';
  }
}
