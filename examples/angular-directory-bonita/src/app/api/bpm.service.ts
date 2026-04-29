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

@Injectable({ providedIn: 'root' })
export class BpmService {
  private http = inject(HttpClient);
  private tasks = inject(TasksService);

  getProcesses(page = 0, size = 20): Observable<SafeResult<BonitaProcess[]>> {
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    params.append('o', 'lastUpdateDate DESC');
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
    params.append('o', 'start DESC');
    params.append('d', 'processDefinitionId');
    return this.http
      .get<BonitaCase[]>(`/bonita/API/bpm/case?${params}`, { observe: 'response' })
      .pipe(
        map((r) => this.toSafeResult(r)),
        catchError((e) => of(this.errorResult<BonitaCase[]>(e)))
      );
  }

  getCasesArchivedToday(): Observable<SafeResult<BonitaArchivedCase[]>> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const params = new URLSearchParams();
    params.set('p', '0');
    params.set('c', '50');
    params.append('o', 'archivedDate DESC');
    params.append('f', `archivedDate>=${todayStr}`);
    return this.http
      .get<BonitaArchivedCase[]>(`/bonita/API/bpm/archivedCase?${params}`, { observe: 'response' })
      .pipe(
        map((r) => this.toSafeResult(r)),
        catchError((e) => of(this.errorResult<BonitaArchivedCase[]>(e)))
      );
  }

  loadSnapshot(userId: string): Observable<BpmSnapshot> {
    return forkJoin({
      processes: this.getProcesses(),
      openCases: this.getOpenCases(),
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
