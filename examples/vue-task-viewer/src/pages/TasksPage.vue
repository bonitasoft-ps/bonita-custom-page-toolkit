<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import {
  ElCard,
  ElTable,
  ElTableColumn,
  ElTag,
  ElButton,
  ElMessage,
  ElEmpty,
} from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { getMyPendingTasks, type BonitaTask } from '@/api/tasks';

const auth = useAuthStore();
const tasks = ref<BonitaTask[]>([]);
const total = ref(0);
const loading = ref(false);

const PRIORITY_COLOR: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
  highest: 'danger',
  above_normal: 'warning',
  normal: 'primary',
  under_normal: 'info',
  lowest: 'info',
};

async function load() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const { data, total: t } = await getMyPendingTasks(auth.user.userId, 0, 50);
    tasks.value = data;
    total.value = t >= 0 ? t : data.length;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'Failed to load tasks');
  } finally {
    loading.value = false;
  }
}

function fmt(d?: string) {
  return d ? new Date(d).toLocaleString() : '—';
}

onMounted(load);
watch(() => auth.user?.userId, () => load());
</script>

<template>
  <ElCard>
    <template #header>
      <div class="card-header">
        <span class="title">
          My pending tasks
          <span class="count">({{ total }} total)</span>
        </span>
        <ElButton :icon="Refresh" :loading="loading" @click="load">Refresh</ElButton>
      </div>
    </template>

    <ElTable :data="tasks" v-loading="loading" stripe>
      <ElTableColumn label="Task">
        <template #default="{ row }">
          {{ row.displayName || row.name }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="priority" label="Priority" width="160">
        <template #default="{ row }">
          <ElTag :type="PRIORITY_COLOR[row.priority] ?? 'info'">{{ row.priority }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="caseId" label="Case" width="120" />
      <ElTableColumn label="Due" width="200">
        <template #default="{ row }">{{ fmt(row.dueDate) }}</template>
      </ElTableColumn>
      <template #empty>
        <ElEmpty description="No pending tasks" />
      </template>
    </ElTable>
  </ElCard>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.count {
  font-weight: 400;
  color: #909399;
  margin-left: 8px;
}
</style>
