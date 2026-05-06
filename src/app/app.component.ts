import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AiChatWidgetComponent } from './shared/components/ai-chat-widget/ai-chat-widget.component';
import { AuthService } from './core/services/auth.service';
import { FavoritesService } from './core/services/favorites.service';
import { catchError, filter, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    AiChatWidgetComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      window.scrollTo(0, 0);
    });

    this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user?.role !== 'buyer') {
          this.favoritesService.clearFavorites();
          return of([]);
        }

        return this.favoritesService.loadFavorites(user.id).pipe(
          catchError(() => {
            this.favoritesService.clearFavorites();
            return of([]);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  get showNavbar(): boolean {
    const currentUrl = this.router.url;
    const authPages = ['/login', '/register', '/forgot-password'];
    const isAuthPage = authPages.some((page) => currentUrl.includes(page));
    return !isAuthPage;
  }

  get showFooter(): boolean {
    const currentUrl = this.router.url;
    const authPages = ['/login', '/register', '/forgot-password'];
    const isAuthPage = authPages.some((page) => currentUrl.includes(page));
    const isMapSearch = currentUrl.includes('/buyer/map-search');
    return !isAuthPage && !isMapSearch;
  }

  get showChatWidget(): boolean {
    const currentPath = this.router.url.split('?')[0];
    return currentPath !== '/login' && currentPath !== '/register';
  }
}
