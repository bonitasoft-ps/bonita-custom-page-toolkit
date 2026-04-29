import { createStore } from 'solid-js/store';
import { getSession, logout as apiLogout } from '../api/auth';
import type { BonitaSession } from '../api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

const [state, setState] = createStore<AuthState>({
  user: null,
  isLoading: true,
});

function toUser(s: BonitaSession): AuthUser {
  return {
    userId: s.user_id,
    userName: s.user_name,
    displayName: s.user_name,
    isTechnicalUser: s.is_technical_user,
  };
}

export const authStore = {
  get user() { return state.user; },
  get isLoading() { return state.isLoading; },
  get isAuthenticated() { return state.user !== null; },

  async loadSession() {
    setState('isLoading', true);
    try {
      const s = await getSession();
      setState('user', toUser(s));
    } catch {
      setState('user', null);
    } finally {
      setState('isLoading', false);
    }
  },

  setUserFromSession(s: BonitaSession) {
    setState('user', toUser(s));
  },

  async logoutAndClear() {
    try {
      await apiLogout();
    } finally {
      setState('user', null);
    }
  },

  clearUser() {
    setState('user', null);
  },
};
