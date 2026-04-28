<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElForm, ElFormItem, ElInput, ElButton, ElCard, ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { login, getSession } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const loading = ref(false);

async function onSubmit() {
  if (!username.value || !password.value) return;
  loading.value = true;
  try {
    await login(username.value, password.value);
    const s = await getSession();
    auth.setUserFromSession(s);
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch {
    ElMessage.error('Invalid credentials');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <ElCard class="login-card" shadow="hover">
      <h2 class="title">Sign in</h2>
      <ElForm @submit.prevent="onSubmit" label-position="top">
        <ElFormItem>
          <ElInput v-model="username" placeholder="Username" autocomplete="username" :prefix-icon="User" />
        </ElFormItem>
        <ElFormItem>
          <ElInput
            v-model="password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            :prefix-icon="Lock"
            show-password
          />
        </ElFormItem>
        <ElButton type="primary" native-type="submit" :loading="loading" style="width: 100%">
          Sign in
        </ElButton>
      </ElForm>
    </ElCard>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh;
  background: #f3f3f1;
}
.login-card {
  width: 360px;
}
.title {
  text-align: center;
  margin: 0 0 16px;
  color: #303133;
}
</style>
