import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../stores/auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  // The Bonita session probe runs as APP_INITIALIZER, so by the time this
  // guard executes the auth state is already resolved. No isLoading() check
  // is needed — if isAuthenticated() is false we genuinely have no session.
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  return true;
};
