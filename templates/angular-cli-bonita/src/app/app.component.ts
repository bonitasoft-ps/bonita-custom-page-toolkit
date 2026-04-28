import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { setSessionExpiredHandler } from './api/client';
import { AuthStore } from './stores/auth.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private store = inject(AuthStore);

  ngOnInit() {
    // Session probe runs in APP_INITIALIZER (see app.config.ts) — by the time
    // we reach this hook, isAuthenticated() already reflects the real state.
    // Here we only wire up the session-expired handler for runtime 401/403.
    setSessionExpiredHandler(() => this.store.handleSessionExpired());
  }
}
