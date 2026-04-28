import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, BonitaSession } from '../api/auth.service';

export interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
  isTechnicalUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = signal<AuthUser | null>(null);
  isLoading = signal(true);
  isAuthenticated = computed(() => this.user() !== null);

  async loadSession(): Promise<void> {
    this.isLoading.set(true);
    try {
      const s = await firstValueFrom(this.auth.getSession());
      this.user.set(this.toUser(s));
    } catch {
      this.user.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  setUserFromSession(s: BonitaSession): void {
    this.user.set(this.toUser(s));
  }

  async logoutAndRedirect(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      this.user.set(null);
      this.router.navigate(['/login']);
    }
  }

  handleSessionExpired(): void {
    this.user.set(null);
    this.router.navigate(['/login']);
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
