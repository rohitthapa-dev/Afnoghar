import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const sellerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (authService.isSeller()) {
    return true;
  }

  if (authService.isBuyer()) {
    router.navigate(['/buyer/home']);
  } else if (authService.isAdmin()) {
    router.navigate(['/admin/dashboard']);
  }

  return false;
};
