import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, of, catchError, map } from 'rxjs';
import { TasksService, type BonitaTask } from './tasks.service';

export interface BonitaProcess {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  activationState: string;
  configurationState?: string;
  deploymentDate: string;
  deployedBy?: string;
  lastUpdateDate?: string;
}

export interface BonitaCase {
  id: string;
  state?: string;
  start: string;
  end?: string;
  started_by?: string;
  processDefinitionId: string;
  rootCaseId?: string;
}

export interface BonitaArchivedCase extends BonitaCase {
  end: string;
  archivedDate: string;
}

export interface SafeResult<T> {
  data: T;
  total: number;
  error: string | null;
}

export interface BpmSnapshot {
  processes: SafeResult<BonitaProcess[]>;
  openCases: SafeResult<BonitaCase[]>;
  closedToday: SafeResult<BonitaArchivedCase[]>;
  tasks: SafeResult<BonitaTask[]>;
}

// ── Bonita API quirks ─────────────────────────────────────────────────
// We deliberately keep these URLs simple:
//
//   - `o=lastUpdateDate DESC` on /bpm/process returns HTTP 500 with
//     "Can't find search descriptor corresponding to lastUpdateDate".
//   - `o=start DESC` and `d=processDefinitionId` on /bpm/case can also fail.
//   - `f=archivedDate>=YYYY-MM-DD` on /bpm/archivedCase returned 500
//     in tests against Bonita 2025.x.
//
// Sorting + "today" filtering is done client-side from the returned data.

@Injectable({ providedIn: 'root' })
export class BpmService {
  private http = inject(HttpClient);
  private tasks = inject(TasksService);

  getProcesses(page = 0, size = 20): Observable<SafeResult<BonitaProcess[]>> {
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    return this.http
      .get<BonitaProcess[]>(`/bonita/API/bpm/process?${params}`, { observe: 'response' })
      .pipe(
        map((r) => this.toSafeResult(r)),
        catchError((e) => of(this.errorResult<BonitaProcess[]>(e)))
      );
  }

  getOpenCases(page = 0, size = 20): Observable<SafeResult<BonitaCase[]>> {
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    return this.http
      .get<BonitaCase[]>(`/bonita/API/bpm/case?${params}`, { observe: 'response' })
      .pipe(
        map((r) => this.toSafeResult(r)),
        catchError((e) => of(this.errorResult<BonitaCase[]>(e)))
      );
  }

  getCasesArchivedToday(): Observable<SafeResult<BonitaArchivedCase[]>> {
    const params = new URLSearchParams();
    params.set('p', '0');
    params.set('c', '100');
    return this.http
      .get<BonitaArchivedCase[]>(`/bonita/API/bpm/archivedCase?${params}`, { observe: 'response' })
      .pipe(
        map((r) => {
          const all = r.body ?? [];
          // Filter to today client-side
          const now = new Date();
          const isToday = (raw?: string) => {
            if (!raw) return false;
            const d = new Date(raw);
            return d.getFullYear() === now.getFullYear()
              && d.getMonth() === now.getMonth()
              && d.getDate() === now.getDate();
          };
          const filtered = all.filter((c) => isToday(c.archivedDate) || isToday(c.end));
          return { data: filtered, total: filtered.length, error: null as string | null };
        }),
        catchError((e) => of(this.errorResult<BonitaArchivedCase[]>(e)))
      );
  }

  loadSnapshot(userId: string): Observable<BpmSnapshot> {
    return forkJoin({
      processes: this.getProcesses(0, 50),
      openCases: this.getOpenCases(0, 50),
      closedToday: this.getCasesArchivedToday(),
      tasks: this.tasks
        .getMyPendingTasks(userId, 0, 100)
        .pipe(
          map(({ data, total }) => ({ data, total, error: null as string | null })),
          catchError((e) => of(this.errorResult<BonitaTask[]>(e)))
        ),
    });
  }

  private toSafeResult<T>(res: HttpResponse<T>): SafeResult<T> {
    const range = res.headers.get('Content-Range');
    const total = range ? Number(range.split('/')[1]) : -1;
    const data = res.body ?? ([] as unknown as T);
    return { data, total, error: null };
  }

  private errorResult<T>(e: unknown): SafeResult<T> {
    return {
      data: [] as unknown as T,
      total: -1,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
