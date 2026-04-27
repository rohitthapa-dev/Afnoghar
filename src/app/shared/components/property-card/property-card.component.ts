import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Property } from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyTypePipe } from '../../pipes/property-type.pipe';
import { PriceFormatPipe } from '../../pipes/price-format.pipe';

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    PropertyTypePipe,
    PriceFormatPipe,
  ],
  templateUrl: './property-card.component.html',
  styleUrl: './property-card.component.scss',
})
export class PropertyCardComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  @Input() property!: Property;
  @Input() mode: 'view' | 'full' = 'view';

  @Output() viewDetails = new EventEmitter<number>();
  @Output() bookAppointment = new EventEmitter<number>();
  @Output() favoriteToggled = new EventEmitter<number>();

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
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
    this.favoriteToggled.emit(this.property.id);
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
