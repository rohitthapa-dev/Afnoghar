import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      window.scrollTo(0, 0);
    });
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
}
