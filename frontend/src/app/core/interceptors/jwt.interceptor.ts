import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // If token is expired before sending request, clear session immediately
  if (auth.token() && auth.isTokenExpired()) {
    auth.clearSession();
    router.navigate(['/login'], { queryParams: { expired: '1' } });
  }

  const token = auth.token();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 422) {
        // Token expired, revoked, or invalid
        auth.clearSession();
        router.navigate(['/login'], { queryParams: { expired: '1' } });
      }
      return throwError(() => error);
    })
  );
};

