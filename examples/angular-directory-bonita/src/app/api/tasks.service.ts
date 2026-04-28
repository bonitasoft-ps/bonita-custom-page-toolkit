import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BonitaTask {
  id: string;
  name: string;
  displayName?: string;
  caseId: string;
  state: string;
  priority: string;
  dueDate?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);

  getMyPendingTasks(
    userId: string,
    page = 0,
    size = 20
  ): Observable<{ data: BonitaTask[]; total: number }> {
    const params = new URLSearchParams();
    params.set('p', String(page));
    params.set('c', String(size));
    params.append('f', 'state=ready');
    params.append('f', `user_id=${userId}`);
    // Bonita 2025.x requires one `o` param per ordering criterion (not comma-separated)
    params.append('o', 'priority DESC');
    params.append('o', 'dueDate ASC');

    return this.http
      .get<BonitaTask[]>(`/bonita/API/bpm/humanTask?${params}`, { observe: 'response' })
      .pipe(
        map((res: HttpResponse<BonitaTask[]>) => {
          const range = res.headers.get('Content-Range');
          const total = range ? Number(range.split('/')[1]) : -1;
          const data = res.body ?? [];
          return { data, total: total >= 0 ? total : data.length };
        })
      );
  }
}
