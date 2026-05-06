import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { Property } from '../../../core/models/property.model';
import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';

@Component({
  selector: 'app-buyer-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-home.component.html',
  styleUrl: './buyer-home.component.scss',
})
export class BuyerHomeComponent implements OnInit {
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private router = inject(Router);

  featuredProperties: Property[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadFeaturedProperties();
  }

  loadFeaturedProperties(): void {
    this.loading = true;
    this.error = '';

    this.propertyService.getFeaturedProperties(6).subscribe({
      next: (properties) => {
        this.featuredProperties = properties;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load properties. Please try again.';
        this.loading = false;
      },
    });
  }

  onSearchProperties(): void {
    this.router.navigate(['/buyer/properties']);
  }

  onViewMap(): void {
    this.router.navigate(['/buyer/map-search'], {
      queryParams: { view: 'map' },
    });
  }
}
