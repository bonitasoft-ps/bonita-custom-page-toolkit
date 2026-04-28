import { Component, computed, effect, inject, signal } from '@angular/core';
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
        <p class="error">{{ error() }}</p>
      }

      @if (!loading() && tasks().length === 0) {
        <p class="empty">No pending tasks.</p>
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
    .error { color: #c00; }
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
  `],
})
export class TasksPage {
  private store = inject(AuthStore);
  private tasksService = inject(TasksService);

  tasks = signal<BonitaTask[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);

  private userId = computed(() => this.store.user()?.userId);

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id) this.load();
    });
  }

  async load() {
    const id = this.userId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data, total } = await firstValueFrom(
        this.tasksService.getMyPendingTasks(id, 0, 50)
      );
      this.tasks.set(data);
      this.total.set(total);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      this.loading.set(false);
    }
  }

  priorityColor(p: string): string {
    return PRIORITY_COLOR[p] ?? '#909399';
  }

  formatDate(d?: string): string {
    return d ? new Date(d).toLocaleString() : '—';
  }
}
