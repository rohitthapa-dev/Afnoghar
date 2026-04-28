import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

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
    return !isAuthPage;
  }
}
