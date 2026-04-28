import { apiRequestWithCount } from './client';

export interface BonitaTask {
  id: string;
  name: string;
  displayName?: string;
  caseId: string;
  state: string;
  priority: string;
  dueDate?: string;
  description?: string;
  rootContainerId?: string;
}

export async function getMyPendingTasks(
  userId: string,
  page = 0,
  size = 20
): Promise<{ data: BonitaTask[]; total: number }> {
  const params = new URLSearchParams();
  params.set('p', String(page));
  params.set('c', String(size));
  params.append('f', 'state=ready');
  params.append('f', `user_id=${userId}`);
  // Bonita 2025.x requires one `o` param per ordering criterion (not comma-separated)
  params.append('o', 'priority DESC');
  params.append('o', 'dueDate ASC');
  return apiRequestWithCount<BonitaTask[]>(`/bpm/humanTask?${params}`);
}
