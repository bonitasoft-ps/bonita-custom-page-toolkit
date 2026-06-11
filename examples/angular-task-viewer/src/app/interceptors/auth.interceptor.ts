import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { getCsrfTokenFromCookie, notifySessionExpired } from '../api/client';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/bonita/')) {
    return next(req);
  }

  const token = getCsrfTokenFromCookie();
  const setHeaders: Record<string, string> = {};
  if (token) setHeaders['X-Bonita-API-Token'] = token;

  const updated = req.clone({
    setHeaders,
    withCredentials: true,
  });

  return next(updated).pipe(
    catchError((err: HttpErrorResponse) => {
      if ((err.status === 401 || err.status === 403) && !req.url.includes('/loginservice')) {
        notifySessionExpired();
      }
      return throwError(() => err);
    })
  );
};
