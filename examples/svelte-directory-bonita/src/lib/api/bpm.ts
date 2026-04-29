import { apiRequestWithCount } from './client';
import { getMyPendingTasks } from './tasks';
import type { BonitaTask } from './tasks';

export interface BonitaProcess {
  id: string; name: string; displayName?: string; version: string;
  description?: string; activationState: string; configurationState?: string;
  deploymentDate: string; deployedBy?: string; lastUpdateDate?: string;
}
export interface BonitaCase {
  id: string; state?: string; start: string; end?: string;
  started_by?: string; processDefinitionId: string; rootCaseId?: string;
}
export interface BonitaArchivedCase extends BonitaCase { end: string; archivedDate: string; }

export type { BonitaTask } from './tasks';

export async function getProcesses(page = 0, size = 20) {
  const params = new URLSearchParams();
  params.set('p', String(page)); params.set('c', String(size));
  params.append('o', 'lastUpdateDate DESC');
  return apiRequestWithCount<BonitaProcess[]>(`/bpm/process?${params}`);
}
export async function getOpenCases(page = 0, size = 20) {
  const params = new URLSearchParams();
  params.set('p', String(page)); params.set('c', String(size));
  params.append('o', 'start DESC'); params.append('d', 'processDefinitionId');
  return apiRequestWithCount<BonitaCase[]>(`/bpm/case?${params}`);
}
export async function getCasesArchivedToday() {
  const t = new Date();
  const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const params = new URLSearchParams();
  params.set('p', '0'); params.set('c', '50');
  params.append('o', 'archivedDate DESC');
  params.append('f', `archivedDate>=${todayStr}`);
  return apiRequestWithCount<BonitaArchivedCase[]>(`/bpm/archivedCase?${params}`);
}

export interface BpmSnapshot {
  processes: { data: BonitaProcess[]; total: number; error: string | null };
  openCases: { data: BonitaCase[]; total: number; error: string | null };
  closedToday: { data: BonitaArchivedCase[]; total: number; error: string | null };
  tasks: { data: BonitaTask[]; total: number; error: string | null };
}

async function safe<T>(fn: () => Promise<{ data: T; total: number }>) {
  try { return { ...(await fn()), error: null }; }
  catch (e) { return { data: [] as unknown as T, total: -1, error: e instanceof Error ? e.message : String(e) }; }
}

export async function loadSnapshot(userId: string): Promise<BpmSnapshot> {
  const [processes, openCases, closedToday, tasks] = await Promise.all([
    safe(() => getProcesses(0, 20)),
    safe(() => getOpenCases(0, 20)),
    safe(() => getCasesArchivedToday()),
    safe(() => getMyPendingTasks(userId, 0, 100)),
  ]);
  return { processes, openCases, closedToday, tasks };
}
