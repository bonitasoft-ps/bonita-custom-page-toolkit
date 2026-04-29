import { apiRequestWithCount } from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface BonitaProcess {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  activationState: string;       // ENABLED | DISABLED
  configurationState?: string;   // RESOLVED | UNRESOLVED
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
  failedFlowNodes?: string;
}

export interface BonitaArchivedCase extends BonitaCase {
  end: string;
  archivedDate: string;
}

// Existing in tasks.ts — re-exported from here for convenience
export type { BonitaTask } from './tasks';
export { getMyPendingTasks } from './tasks';

// ── Process catalog ───────────────────────────────────────────────────

export async function getProcesses(
  page = 0,
  size = 20
): Promise<{ data: BonitaProcess[]; total: number }> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('o', 'lastUpdateDate DESC');
  return apiRequestWithCount<BonitaProcess[]>(`/bpm/process?${params}`);
}

// ── Open cases ────────────────────────────────────────────────────────

export async function getOpenCases(
  page = 0,
  size = 20
): Promise<{ data: BonitaCase[]; total: number }> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('o', 'start DESC');
  // d=processDefinitionId so we can resolve the process name later if needed
  params.append('d', 'processDefinitionId');
  return apiRequestWithCount<BonitaCase[]>(`/bpm/case?${params}`);
}

// ── Archived cases (today) ────────────────────────────────────────────

export async function getCasesArchivedToday(): Promise<{ data: BonitaArchivedCase[]; total: number }> {
  // Bonita filter syntax for date ranges is f=archivedDate>=YYYY-MM-DD
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const params = new URLSearchParams();
  params.set('p', '0');
  params.set('c', '50');
  // Bonita 2025.x: repeat `o` per criterion (NOT comma-separated)
  params.append('o', 'archivedDate DESC');
  params.append('f', `archivedDate>=${todayStr}`);
  return apiRequestWithCount<BonitaArchivedCase[]>(`/bpm/archivedCase?${params}`);
}

// ── Aggregate snapshot for the dashboard ──────────────────────────────
// Loads everything in parallel, fails individually so a 403 on one endpoint
// (e.g. archivedCase if the user lacks permission) doesn't take down the rest.

import { getMyPendingTasks } from './tasks';
import type { BonitaTask } from './tasks';

export interface BpmSnapshot {
  processes: { data: BonitaProcess[]; total: number; error: string | null };
  openCases: { data: BonitaCase[]; total: number; error: string | null };
  closedToday: { data: BonitaArchivedCase[]; total: number; error: string | null };
  tasks: { data: BonitaTask[]; total: number; error: string | null };
}

async function safe<T>(fn: () => Promise<{ data: T; total: number }>) {
  try {
    return { ...(await fn()), error: null };
  } catch (e) {
    return { data: [] as unknown as T, total: -1, error: e instanceof Error ? e.message : String(e) };
  }
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
