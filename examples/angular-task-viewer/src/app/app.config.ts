import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthStore } from './stores/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Probe Bonita session BEFORE the router bootstraps.
    // This guarantees that when the auth guard runs, isLoading() is already false
    // and isAuthenticated() reflects the real session state — so users landing
    // inside a Bonita iframe go straight to the app instead of bouncing to /login.
    {
      provide: APP_INITIALIZER,
      useFactory: (store: AuthStore) => () => store.loadSession(),
      deps: [AuthStore],
      multi: true,
    },
  ],
};
