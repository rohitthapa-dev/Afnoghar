import { Component, Input, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Property } from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { PropertyTypePipe } from '../../pipes/property-type.pipe';
import { PriceFormatPipe } from '../../pipes/price-format.pipe';

export interface FavoriteToggleEvent {
  property: Property;
  action: 'added' | 'removed';
}

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    PropertyTypePipe,
    PriceFormatPipe,
  ],
  templateUrl: './property-card.component.html',
  styleUrl: './property-card.component.scss',
})
export class PropertyCardComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private favoritesService = inject(FavoritesService);
  private snackBar = inject(MatSnackBar);

  @Input() property!: Property;
  @Input() mode: 'view' | 'full' = 'view';
  @Input() showFavoriteFeedback = true;

  @Output() viewDetails = new EventEmitter<number>();
  @Output() bookAppointment = new EventEmitter<number>();
  @Output() favoriteToggled = new EventEmitter<FavoriteToggleEvent>();

  isFavorite = computed(() =>
    this.favoritesService.isFavorite(this.property?.id)
  );

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get isBuyer(): boolean {
    return this.authService.isBuyer();
  }

  getPropertyUrl(): string {
    return (
      this.property?.images?.[0] ||
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'
    );
  }

  getLocation(): string {
    if (!this.property?.location) return '';
    return `${this.property.location.city}, ${this.property.location.district}`;
  }

  onCardClick(): void {
    this.viewDetails.emit(this.property.id);
    this.router.navigate(['/buyer/properties', this.property.id]);
  }

  onFavoriteClick(event: Event): void {
    event.stopPropagation();

    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: {
          returnUrl: `/buyer/properties/${this.property.id}`,
        },
      });
      return;
    }

    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) return;

    this.favoritesService.toggleFavorite(this.property.id, userId).subscribe({
      next: (result) => {
        if (result.action === 'removed' && this.showFavoriteFeedback) {
          this.snackBar.open('Removed from favorites', 'Undo', {
            duration: 3000,
            horizontalPosition: 'start',
            verticalPosition: 'bottom',
          }).onAction().subscribe(() => {
            this.favoritesService.toggleFavorite(this.property.id, userId).subscribe();
          });
        }
        this.favoriteToggled.emit({
          property: this.property,
          action: result.action,
        });
      },
    });
  }

  onBookAppointmentClick(event: Event): void {
    event.stopPropagation();
    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: {
          returnUrl: `/buyer/properties/${this.property.id}`,
        },
      });
      return;
    }
    this.bookAppointment.emit(this.property.id);
    this.router.navigate(['/buyer/appointments/new'], {
      queryParams: { propertyId: this.property.id },
    });
  }
}
