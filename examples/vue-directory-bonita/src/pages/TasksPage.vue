<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ElCard, ElTable, ElTableColumn, ElTag, ElButton, ElMessage, ElEmpty,
  ElInput, ElSelect, ElOption, ElDialog, ElTabs, ElTabPane, ElProgress, ElAlert,
} from 'element-plus';
import {
  Refresh, Search, Clock, Bell, Calendar, Warning, InfoFilled,
  Connection, Folder, CircleCheck, Promotion,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { loadSnapshot, type BpmSnapshot, type BonitaTask, type BonitaProcess, type BonitaCase } from '@/api/bpm';

const auth = useAuthStore();

const PRIORITIES = ['highest', 'above_normal', 'normal', 'under_normal', 'lowest'] as const;
type Priority = typeof PRIORITIES[number];

const PRIORITY_META: Record<Priority, { label: string; color: string; tag: '' | 'success' | 'warning' | 'info' | 'primary' | 'danger' }> = {
  highest:      { label: 'Highest', color: '#c0392b', tag: 'danger' },
  above_normal: { label: 'High',    color: '#e67e22', tag: 'warning' },
  normal:       { label: 'Normal',  color: '#3498db', tag: 'primary' },
  under_normal: { label: 'Low',     color: '#16a085', tag: 'success' },
  lowest:       { label: 'Lowest',  color: '#7f8c8d', tag: 'info' },
};

const snapshot = ref<BpmSnapshot | null>(null);
const loading = ref(false);

const search = ref('');
const priorityFilter = ref<Priority | 'all'>('all');
const sortBy = ref<'priority' | 'dueDate' | 'name'>('priority');
const detailTask = ref<BonitaTask | null>(null);

function isOverdue(t: BonitaTask) {
  return !!t.dueDate && new Date(t.dueDate).getTime() < Date.now();
}
function isDueToday(t: BonitaTask) {
  if (!t.dueDate) return false;
  const d = new Date(t.dueDate); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

async function load() {
  if (!auth.user) return;
  loading.value = true;
  try {
    snapshot.value = await loadSnapshot(auth.user.userId);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Failed to load');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => auth.user?.userId, () => load());

const tasks = computed(() => snapshot.value?.tasks.data ?? []);
const tasksTotal = computed(() => snapshot.value?.tasks.total ?? 0);
const processes = computed(() => snapshot.value?.processes.data ?? []);
const processesTotal = computed(() => snapshot.value?.processes.total ?? 0);
const openCases = computed(() => snapshot.value?.openCases.data ?? []);
const openCasesTotal = computed(() => snapshot.value?.openCases.total ?? 0);
const closedToday = computed(() => snapshot.value?.closedToday.data ?? []);
const closedTodayTotal = computed(() => snapshot.value?.closedToday.total ?? 0);

const enabledProcesses = computed(() => processes.value.filter(p => p.activationState === 'ENABLED').length);

const stats = computed(() => {
  const t = tasks.value;
  const overdue = t.filter(isOverdue).length;
  const dueToday = t.filter(isDueToday).length;
  const highPriority = t.filter(x => x.priority === 'highest' || x.priority === 'above_normal').length;
  const distribution: Record<Priority, number> = { highest: 0, above_normal: 0, normal: 0, under_normal: 0, lowest: 0 };
  for (const x of t) {
    const p = (PRIORITIES.includes(x.priority as Priority) ? x.priority : 'normal') as Priority;
    distribution[p]++;
  }
  const maxCount = Math.max(1, ...Object.values(distribution));
  return { overdue, dueToday, highPriority, distribution, maxCount };
});

const visibleTasks = computed(() => {
  const lower = search.value.trim().toLowerCase();
  const rank: Record<string, number> = { highest: 0, above_normal: 1, normal: 2, under_normal: 3, lowest: 4 };
  return tasks.value
    .filter(t => {
      if (priorityFilter.value !== 'all' && t.priority !== priorityFilter.value) return false;
      if (!lower) return true;
      return `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase().includes(lower);
    })
    .slice()
    .sort((a, b) => {
      if (sortBy.value === 'priority') return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (sortBy.value === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
});

const distributionEntries = computed(() => PRIORITIES.map(p => ({
  priority: p,
  count: stats.value.distribution[p],
  pct: Math.round((stats.value.distribution[p] / Math.max(1, tasks.value.length)) * 100),
  color: PRIORITY_META[p].color,
  label: PRIORITY_META[p].label,
})));

function fmt(d?: string) { return d ? new Date(d).toLocaleString() : '—'; }
function priorityColor(p: string) { return PRIORITY_META[p as Priority]?.color ?? '#909399'; }
function priorityTag(p: string) {
  return (PRIORITY_META[p as Priority]?.tag ?? 'info') as 'success' | 'warning' | 'info' | 'primary' | 'danger';
}
function priorityLabel(p: string) { return PRIORITY_META[p as Priority]?.label ?? p; }

function rowClassName({ row }: { row: BonitaTask }) {
  return isOverdue(row) ? 'row-overdue' : '';
}
</script>

<template>
  <div class="dashboard">
    <!-- TOP KPIs -->
    <div class="kpi-row">
      <ElCard class="kpi-card">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#41B883"><Connection /></ElIcon>
          <div>
            <div class="kpi-title">Active processes</div>
            <div class="kpi-value">
              {{ enabledProcesses }}
              <span v-if="processesTotal > 0" class="kpi-suffix">/ {{ processesTotal }}</span>
            </div>
            <div class="kpi-sub">Deployed and enabled</div>
          </div>
        </div>
      </ElCard>
      <ElCard class="kpi-card">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#3498db"><Folder /></ElIcon>
          <div>
            <div class="kpi-title">Open cases</div>
            <div class="kpi-value">{{ openCasesTotal >= 0 ? openCasesTotal : openCases.length }}</div>
            <div class="kpi-sub">In-flight process instances</div>
          </div>
        </div>
      </ElCard>
      <ElCard class="kpi-card">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#16a085"><CircleCheck /></ElIcon>
          <div>
            <div class="kpi-title">Closed today</div>
            <div class="kpi-value">{{ closedTodayTotal >= 0 ? closedTodayTotal : closedToday.length }}</div>
            <div class="kpi-sub">Cases archived since 00:00</div>
          </div>
        </div>
      </ElCard>
      <ElCard class="kpi-card">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#e67e22"><Promotion /></ElIcon>
          <div>
            <div class="kpi-title">My tasks</div>
            <div class="kpi-value">{{ tasksTotal }}</div>
            <div class="kpi-sub">Pending in my inbox</div>
          </div>
        </div>
      </ElCard>
    </div>

    <!-- SECONDARY KPIs -->
    <div class="kpi-row kpi-row-secondary">
      <ElCard :class="['kpi-card', 'kpi-mini', stats.overdue > 0 ? 'kpi-warn' : '']">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#c0392b"><Warning /></ElIcon>
          <div>
            <div class="kpi-title">Overdue</div>
            <div class="kpi-value" :style="{ color: stats.overdue > 0 ? '#c0392b' : undefined }">
              {{ stats.overdue }}
            </div>
          </div>
        </div>
      </ElCard>
      <ElCard class="kpi-card kpi-mini">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#e67e22"><Calendar /></ElIcon>
          <div>
            <div class="kpi-title">Due today</div>
            <div class="kpi-value">{{ stats.dueToday }}</div>
          </div>
        </div>
      </ElCard>
      <ElCard class="kpi-card kpi-mini">
        <div class="kpi-content">
          <ElIcon class="kpi-icon" color="#e67e22"><Bell /></ElIcon>
          <div>
            <div class="kpi-title">High priority</div>
            <div class="kpi-value">{{ stats.highPriority }}</div>
          </div>
        </div>
      </ElCard>
    </div>

    <!-- DISTRIBUTION CHART -->
    <ElCard class="distribution-card">
      <template #header>
        <div class="card-header-row">
          <ElIcon><InfoFilled /></ElIcon>
          <span>Task priority distribution</span>
        </div>
      </template>
      <ElEmpty v-if="tasks.length === 0" description="No tasks to chart" />
      <div v-else class="distribution-bars">
        <div v-for="e in distributionEntries" :key="e.priority" class="dist-row">
          <div class="dist-label">
            <span class="priority-dot" :style="{ background: e.color }" />
            <span>{{ e.label }}</span>
          </div>
          <div class="dist-bar-track">
            <div
              class="dist-bar-fill"
              :style="{ width: `${(e.count / stats.maxCount) * 100}%`, background: e.color }"
              :title="`${e.count} tasks (${e.pct}%)`"
            />
          </div>
          <div class="dist-count">{{ e.count }}</div>
        </div>
      </div>
    </ElCard>

    <!-- TABS -->
    <ElCard class="data-tabs-card">
      <ElTabs default-active="tasks">
        <ElTabPane label="My tasks" name="tasks">
          <ElAlert
            v-if="snapshot?.tasks.error"
            type="error"
            :title="`Failed to load tasks: ${snapshot.tasks.error}`"
            show-icon
            :closable="false"
            style="margin-bottom: 16px"
          />
          <div class="filters-bar">
            <ElInput
              v-model="search"
              placeholder="Search by name or case…"
              clearable
              style="width: 240px"
              :prefix-icon="Search"
            />
            <ElSelect v-model="priorityFilter" style="width: 150px">
              <ElOption value="all" label="All priorities" />
              <ElOption v-for="p in PRIORITIES" :key="p" :value="p" :label="PRIORITY_META[p].label" />
            </ElSelect>
            <ElSelect v-model="sortBy" style="width: 140px">
              <ElOption value="priority" label="By priority" />
              <ElOption value="dueDate" label="By due date" />
              <ElOption value="name" label="By name" />
            </ElSelect>
            <ElButton :icon="Refresh" :loading="loading" @click="load">Refresh all</ElButton>
          </div>

          <ElTable :data="visibleTasks" v-loading="loading" stripe :row-class-name="rowClassName">
            <ElTableColumn label="Task" min-width="280">
              <template #default="{ row }">
                <div class="task-cell">
                  <span class="priority-dot" :style="{ background: priorityColor(row.priority) }" />
                  <div>
                    <div class="task-name">
                      <strong>{{ row.displayName || row.name }}</strong>
                      <ElTag v-if="isOverdue(row)" type="danger" size="small">Overdue</ElTag>
                      <ElTag v-else-if="isDueToday(row)" type="warning" size="small">Today</ElTag>
                    </div>
                    <div v-if="row.description" class="task-desc">{{ row.description }}</div>
                  </div>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Priority" width="120">
              <template #default="{ row }">
                <ElTag :type="priorityTag(row.priority)">{{ priorityLabel(row.priority) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Case" width="100">
              <template #default="{ row }">
                <code>#{{ row.caseId }}</code>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Due" width="180">
              <template #default="{ row }">{{ fmt(row.dueDate) }}</template>
            </ElTableColumn>
            <ElTableColumn label="" width="100">
              <template #default="{ row }">
                <ElButton size="small" @click="detailTask = row">Details</ElButton>
              </template>
            </ElTableColumn>
            <template #empty>
              <ElEmpty
                :description="tasks.length === 0
                  ? 'No pending tasks. Enjoy the silence.'
                  : 'No tasks match the current filters.'"
              />
            </template>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="`Open cases (${openCases.length})`" name="cases">
          <ElAlert
            v-if="snapshot?.openCases.error"
            type="warning"
            :title="`Limited access: ${snapshot.openCases.error}`"
            show-icon
            :closable="false"
            style="margin-bottom: 16px"
          />
          <ElTable :data="openCases" v-loading="loading">
            <ElTableColumn label="Case" width="100">
              <template #default="{ row }"><code>#{{ row.id }}</code></template>
            </ElTableColumn>
            <ElTableColumn label="Started" width="200">
              <template #default="{ row }">{{ new Date(row.start).toLocaleString() }}</template>
            </ElTableColumn>
            <ElTableColumn label="Started by" width="140" prop="started_by" />
            <ElTableColumn label="Process" prop="processDefinitionId" />
            <template #empty><ElEmpty description="No open cases" /></template>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="`Processes (${processes.length})`" name="processes">
          <ElAlert
            v-if="snapshot?.processes.error"
            type="warning"
            :title="`Limited access: ${snapshot.processes.error}`"
            show-icon
            :closable="false"
            style="margin-bottom: 16px"
          />
          <ElTable :data="processes" v-loading="loading">
            <ElTableColumn label="Process" min-width="240">
              <template #default="{ row }">
                <strong>{{ row.displayName || row.name }}</strong>
                <code style="margin-left: 8px">v{{ row.version }}</code>
                <div v-if="row.description" class="task-desc">{{ row.description }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Status" width="120">
              <template #default="{ row }">
                <ElTag :type="row.activationState === 'ENABLED' ? 'success' : 'info'">
                  {{ row.activationState }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Deployed" width="180">
              <template #default="{ row }">{{ new Date(row.deploymentDate).toLocaleDateString() }}</template>
            </ElTableColumn>
            <template #empty><ElEmpty description="No processes deployed" /></template>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- DETAIL DIALOG -->
    <ElDialog
      :model-value="detailTask !== null"
      :title="detailTask?.displayName || detailTask?.name || ''"
      width="520"
      @update:model-value="(v: boolean) => { if (!v) detailTask = null }"
    >
      <div v-if="detailTask" class="task-detail">
        <div class="detail-grid">
          <div>
            <div class="muted">Priority</div>
            <ElTag :type="priorityTag(detailTask.priority)">{{ priorityLabel(detailTask.priority) }}</ElTag>
          </div>
          <div>
            <div class="muted">Status</div>
            <div>{{ detailTask.state }}</div>
          </div>
          <div>
            <div class="muted">Case ID</div>
            <code>#{{ detailTask.caseId }}</code>
          </div>
          <div>
            <div class="muted">Due date</div>
            <div>
              <span v-if="detailTask.dueDate">
                {{ fmt(detailTask.dueDate) }}
                <ElTag v-if="isOverdue(detailTask)" type="danger" size="small">Overdue</ElTag>
              </span>
              <span v-else class="muted">No due date</span>
            </div>
          </div>
          <div v-if="detailTask.description" class="span-2">
            <div class="muted">Description</div>
            <div>{{ detailTask.description }}</div>
          </div>
          <div class="span-2">
            <div class="muted">Task ID</div>
            <code>{{ detailTask.id }}</code>
          </div>
        </div>
        <div class="detail-progress">
          <div class="muted">Time pressure</div>
          <ElProgress
            :percentage="isOverdue(detailTask) ? 100 : isDueToday(detailTask) ? 80 : detailTask.dueDate ? 40 : 10"
            :color="isOverdue(detailTask) ? '#c0392b' : isDueToday(detailTask) ? '#e67e22' : '#3498db'"
            :show-text="false"
          />
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<style scoped>
/* Component-scoped overrides; shared dashboard rules in dashboard.css */
.dashboard { display: flex; flex-direction: column; gap: 16px; }

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.kpi-row-secondary {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .kpi-row-secondary { grid-template-columns: 1fr; }
}

.kpi-card { border-radius: 10px; transition: transform 0.12s, box-shadow 0.12s; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.06); }
.kpi-card.kpi-warn { border-color: #f6c948; background: linear-gradient(180deg, #fff8e1, white); }

.kpi-content { display: flex; align-items: flex-start; gap: 14px; }
.kpi-icon { font-size: 26px; padding: 10px; background: #f4f4f7; border-radius: 8px; }
.kpi-title { font-size: 13px; color: #909399; margin-bottom: 4px; }
.kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; color: #303133; }
.kpi-suffix { font-size: 14px; color: #909399; margin-left: 4px; }
.kpi-sub { font-size: 12px; color: #909399; margin-top: 4px; }

.distribution-card, .data-tabs-card { border-radius: 10px; }
.card-header-row { display: flex; align-items: center; gap: 8px; font-weight: 500; }

.distribution-bars { display: flex; flex-direction: column; gap: 10px; }
.dist-row { display: grid; grid-template-columns: 110px 1fr 32px; align-items: center; gap: 12px; }
.dist-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #606266; }
.priority-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dist-bar-track { height: 16px; background: #f4f4f7; border-radius: 8px; overflow: hidden; }
.dist-bar-fill { height: 100%; border-radius: 8px; transition: width 0.4s ease-out; min-width: 2px; }
.dist-count { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }

.filters-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }

.task-cell { display: flex; align-items: flex-start; gap: 10px; }
.task-cell .priority-dot { margin-top: 6px; }
.task-name { font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-desc { font-size: 12px; color: #909399; margin-top: 2px; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.detail-grid .span-2 { grid-column: span 2; }
.muted { font-size: 12px; color: #909399; margin-bottom: 4px; }
.detail-progress { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }
</style>
