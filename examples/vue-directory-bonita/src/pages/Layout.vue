<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ElContainer, ElHeader, ElMain, ElButton } from 'element-plus';
import { SwitchButton } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function onLogout() {
  await auth.logoutAndClear();
  router.push('/login');
}
</script>

<template>
  <ElContainer class="layout">
    <ElHeader class="header">
      <h1 class="title">Directory Bonita Vue</h1>
      <div class="actions">
        <span class="user">{{ auth.user?.displayName }}</span>
        <ElButton type="primary" plain :icon="SwitchButton" @click="onLogout">
          Logout
        </ElButton>
      </div>
    </ElHeader>
    <ElMain class="main">
      <RouterView />
    </ElMain>
  </ElContainer>
</template>

<style scoped>
.layout {
  min-height: 100dvh;
}
.header {
  background: #41b883;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user {
  color: rgba(255, 255, 255, 0.85);
}
.main {
  background: #f3f3f1;
  padding: 24px;
}
</style>
