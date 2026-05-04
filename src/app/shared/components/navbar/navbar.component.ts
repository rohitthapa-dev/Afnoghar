import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  Notification,
  NotificationService,
} from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  isScrolled = signal(false);
  mobileMenuOpen = signal(false);
  notificationPanelOpen = signal(false);
  notifications = signal<Notification[]>([]);

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get userRole(): string | null {
    return this.authService.getRole();
  }

  get userName(): string {
    return this.authService.getCurrentUser()?.name || 'User';
  }

  get userEmail(): string {
    return this.authService.getCurrentUser()?.email || '';
  }

  get userAvatar(): string {
    return this.authService.getCurrentUser()?.avatar || '';
  }

  get hasUserAvatar(): boolean {
    return Boolean(this.userAvatar);
  }

  get notificationCount(): number {
    return this.notifications().length;
  }

  get unreadNotificationCount(): number {
    return this.notifications().filter((notification) => !notification.read)
      .length;
  }

  get notificationCountLabel(): string {
    return this.unreadNotificationCount > 9
      ? '9+'
      : String(this.unreadNotificationCount);
  }

  get notificationsRoute(): string {
    if (this.userRole === 'admin') return '/admin/dashboard';
    if (this.userRole === 'seller') return '/seller/appointments';
    if (this.userRole === 'buyer') return '/buyer/appointments';
    return '/';
  }

  get userInitials(): string {
    const name = this.userName;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  ngOnInit(): void {
    this.notificationService.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notifications) => this.notifications.set(notifications));

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (user) {
          this.loadNotifications();
          return;
        }

        this.notificationService.clearNotifications();
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isLoggedIn) this.loadNotifications();
      });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 20);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeNotificationPanel();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleNotificationPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.loadNotifications();
    this.notificationPanelOpen.set(!this.notificationPanelOpen());
  }

  closeNotificationPanel(): void {
    this.notificationPanelOpen.set(false);
  }

  loadNotifications(): void {
    if (!this.isLoggedIn) {
      this.notificationService.clearNotifications();
      return;
    }

    this.notificationService.getNotifications().subscribe({
      error: () => this.notificationService.clearNotifications(),
    });
  }

  dismissNotification(id: number, event?: Event): void {
    event?.stopPropagation();
    this.notificationService.markRead(id).subscribe();
  }

  markAllNotificationsRead(event?: Event): void {
    event?.stopPropagation();
    const unreadNotifications = this.notifications().filter(
      (notification) => !notification.read,
    );

    unreadNotifications.forEach((notification) => {
      this.notificationService.markRead(notification.id).subscribe();
    });
  }

  getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'accepted':
        return 'bi bi-check-circle-fill';
      case 'declined':
      case 'cancelled':
        return 'bi bi-x-circle-fill';
      case 'booked':
        return 'bi bi-calendar-plus-fill';
      default:
        return 'bi bi-calendar2-week-fill';
    }
  }

  logout(): void {
    this.authService.logout();
    this.closeMobileMenu();
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  navigateToMapSearch(listingType: string): void {
    this.router.navigate(['/buyer/map-search'], {
      queryParams: { type: listingType },
    });
  }
}
