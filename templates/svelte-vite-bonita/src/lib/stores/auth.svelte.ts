// Svelte 5 runes-based auth store. The .svelte.ts extension activates runes.

import { getSession, logout as apiLogout } from '../api/auth';
import type { BonitaSession } from '../api/auth';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

class AuthStore {
  user = $state<AuthUser | null>(null);
  isLoading = $state(true);

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  async loadSession(): Promise<void> {
    this.isLoading = true;
    try {
      const s = await getSession();
      this.user = this.toUser(s);
    } catch {
      this.user = null;
    } finally {
      this.isLoading = false;
    }
  }

  setUserFromSession(s: BonitaSession): void {
    this.user = this.toUser(s);
  }

  async logoutAndClear(): Promise<void> {
    try {
      await apiLogout();
    } finally {
      this.user = null;
    }
  }

  clearUser(): void {
    this.user = null;
  }

  private toUser(s: BonitaSession): AuthUser {
    return {
      userId: s.user_id,
      userName: s.user_name,
      displayName: s.user_name,
      isTechnicalUser: s.is_technical_user,
    };
  }
}

export const authStore = new AuthStore();
