import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../api/auth.service';
import { AuthStore } from '../stores/auth.store';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrapper">
      <form (submit)="onSubmit($event)" class="card">
        <h1>Sign in</h1>
        <input
          type="text"
          name="username"
          placeholder="Username"
          autocomplete="username"
          [(ngModel)]="username"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autocomplete="current-password"
          [(ngModel)]="password"
          required
        />
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100dvh;
      background: var(--color-bg, #f3f3f1);
    }
    .card {
      width: 320px;
      padding: 32px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h1 {
      margin: 0 0 8px;
      text-align: center;
    }
    input {
      padding: 10px 12px;
      border: 1px solid var(--color-border, #e4e7ed);
      border-radius: 4px;
      font: inherit;
    }
    input:focus {
      outline: 2px solid var(--color-primary, #dd0031);
      outline-offset: -1px;
    }
    button {
      padding: 10px;
      background: var(--color-primary, #dd0031);
      color: white;
      border: none;
      border-radius: 4px;
    }
    .error {
      color: #c00;
      margin: 0;
      font-size: 14px;
    }
  `],
})
export class LoginPage {
  private auth = inject(AuthService);
  private store = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.username, this.password);
      const s = await firstValueFrom(this.auth.getSession());
      this.store.setUserFromSession(s);
      const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
      this.router.navigateByUrl(redirect);
    } catch {
      this.error.set('Invalid credentials');
    } finally {
      this.loading.set(false);
    }
  }
}
