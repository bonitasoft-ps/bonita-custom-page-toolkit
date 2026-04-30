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

// Re-exports for convenience
export type { BonitaTask } from './tasks';
export { getMyPendingTasks } from './tasks';

// ── Bonita API quirks ─────────────────────────────────────────────────
// We deliberately keep these URLs simple. Reasons learned the hard way:
//
//   - `o=lastUpdateDate DESC` on /bpm/process returns HTTP 500 with
//     "Can't find search descriptor corresponding to lastUpdateDate".
//     The valid search descriptor names depend on the Bonita version
//     and aren't always documented; passing none is always safe.
//   - `o=start DESC` and `d=processDefinitionId` on /bpm/case can also
//     fail depending on the deployment.
//   - `f=archivedDate>=YYYY-MM-DD` on /bpm/archivedCase returned 500
//     in tests against Bonita 2025.x; we filter client-side instead.
//
// Sorting and "today" filtering happens in the components from the
// returned data — for our small page sizes (≤100) the cost is negligible.

export async function getProcesses(
  page = 0,
  size = 20
): Promise<{ data: BonitaProcess[]; total: number }> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  return apiRequestWithCount<BonitaProcess[]>(`/bpm/process?${params}`);
}

export async function getOpenCases(
  page = 0,
  size = 20
): Promise<{ data: BonitaCase[]; total: number }> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  return apiRequestWithCount<BonitaCase[]>(`/bpm/case?${params}`);
}

export async function getCasesArchivedToday(): Promise<{ data: BonitaArchivedCase[]; total: number }> {
  // Fetch a generous batch of recent archives and filter "today" in JS —
  // Bonita rejects f=archivedDate>=YYYY-MM-DD in some deployments.
  const params = new URLSearchParams();
  params.set('p', '0');
  params.set('c', '100');
  const result = await apiRequestWithCount<BonitaArchivedCase[]>(`/bpm/archivedCase?${params}`);

  const now = new Date();
  const isToday = (raw?: string) => {
    if (!raw) return false;
    const d = new Date(raw);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  };

  const filtered = result.data.filter((c) => isToday(c.archivedDate) || isToday(c.end));
  // total: we know exactly how many are from today within the batch we loaded.
  // If there are more archived items than `c=100`, we'll undercount — fine
  // for a dashboard widget, the user can scroll the archive separately.
  return { data: filtered, total: filtered.length };
}

// ── Aggregate snapshot for the dashboard ──────────────────────────────

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
    safe(() => getProcesses(0, 50)),
    safe(() => getOpenCases(0, 50)),
    safe(() => getCasesArchivedToday()),
    safe(() => getMyPendingTasks(userId, 0, 100)),
  ]);
  return { processes, openCases, closedToday, tasks };
}
