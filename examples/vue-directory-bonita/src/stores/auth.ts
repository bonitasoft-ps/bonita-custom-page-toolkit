import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getSession, logout as apiLogout } from '@/api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(true);
  const isAuthenticated = computed(() => user.value !== null);

  async function loadSession() {
    isLoading.value = true;
    try {
      const s = await getSession();
      user.value = {
        userId: s.user_id,
        userName: s.user_name,
        displayName: s.user_name,
        isTechnicalUser: s.is_technical_user,
      };
    } catch {
      user.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  function setUserFromSession(s: { user_id: string; user_name: string; is_technical_user: boolean }) {
    user.value = {
      userId: s.user_id,
      userName: s.user_name,
      displayName: s.user_name,
      isTechnicalUser: s.is_technical_user,
    };
  }

  async function logoutAndClear() {
    try {
      await apiLogout();
    } finally {
      user.value = null;
    }
  }

  function logout() {
    user.value = null;
  }

  return { user, isLoading, isAuthenticated, loadSession, setUserFromSession, logoutAndClear, logout };
});
