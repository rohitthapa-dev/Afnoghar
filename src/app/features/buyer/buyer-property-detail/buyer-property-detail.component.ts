import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { HttpClient } from '@angular/common/http';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { Property } from '../../../core/models/property.model';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';
import { MapViewComponent } from '../../../shared/components/map-view/map-view.component';

@Component({
  selector: 'app-buyer-property-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatChipsModule,
    MatDatepickerModule,
    PriceFormatPipe,
    PropertyTypePipe,
    MapViewComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './buyer-property-detail.component.html',
  styleUrl: './buyer-property-detail.component.scss',
})
export class BuyerPropertyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private favoritesService = inject(FavoritesService);
  private appointmentService = inject(AppointmentService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private http = inject(HttpClient);

  property?: Property;
  loading = true;
  error = '';
  currentImageIndex = 0;

  sellerName = '';
  sellerPhone = '';
  sellerEmail = '';

  appointmentForm: FormGroup;
  submitting = false;
  appointmentSuccess = false;
  minAppointmentDate = new Date();

  readonly fallbackImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200';

  private readonly featureIconMap: Record<string, string> = {
    parking: 'bi-car-front-fill',
    garden: 'bi-tree-fill',
    rooftop: 'bi-building-fill-up',
    security: 'bi-shield-lock-fill',
    'water tank': 'bi-droplet-fill',
    'water supply': 'bi-droplet-half',
    lift: 'bi-arrow-up-square-fill',
    generator: 'bi-plug-fill',
    electricity: 'bi-lightning-charge-fill',
    gym: 'bi-heart-pulse-fill',
    'road access': 'bi-signpost-split-fill',
    wifi: 'bi-wifi',
    balcony: 'bi-door-open-fill',
    furnished: 'bi-lamp-fill',
  };

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get isBuyer(): boolean {
    return this.authService.isBuyer();
  }

  get isFavorite(): boolean {
    return this.property ? this.favoritesService.isFavorite(this.property.id) : false;
  }

  get images(): string[] {
    return this.property?.images || [];
  }

  get hasMultipleImages(): boolean {
    return this.images.length > 1;
  }

  get displayImages(): string[] {
    return this.images.length ? this.images : [this.fallbackImage];
  }

  get previewImages(): string[] {
    return this.displayImages.slice(0, 4);
  }

  constructor() {
    this.appointmentForm = this.fb.group({
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      message: [''],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (!id || isNaN(id)) {
      this.error = 'Invalid property ID';
      this.loading = false;
      return;
    }
    this.loadProperty(id);
  }

  private loadProperty(id: number): void {
    this.loading = true;
    this.error = '';

    this.propertyService.getPropertyById(id).subscribe({
      next: (property) => {
        this.property = property;
        this.loading = false;
        this.loadSellerInfo(property.sellerId);
      },
      error: () => {
        this.error = 'Failed to load property details. Please try again.';
        this.loading = false;
      },
    });
  }

  private loadSellerInfo(sellerId: number): void {
    this.http.get<any[]>(`http://localhost:3000/agents`).subscribe({
      next: (users) => {
        const seller = users.find((u) => u.id === sellerId);
        if (seller) {
          this.sellerName = seller.name;
          this.sellerPhone = seller.phone;
          this.sellerEmail = seller.email;
        }
      },
      error: () => {
        this.sellerName = 'Verified seller';
        this.sellerPhone = 'Contact via appointment';
      },
    });
  }

  nextImage(): void {
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
    }
  }

  prevImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  setImageIndex(index: number): void {
    this.currentImageIndex = index;
  }

  getFeatureIcon(feature: string): string {
    const normalizedFeature = feature.trim().toLowerCase();
    const icon = this.featureIconMap[normalizedFeature] || 'bi-check2-circle';

    return `bi ${icon}`;
  }

  toggleFavorite(): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const userId = this.authService.getCurrentUser()?.id;
    if (!userId || !this.property) return;

    this.favoritesService.toggleFavorite(this.property.id, userId).subscribe({
      next: (result) => {
        const message =
          result.action === 'added'
            ? 'Added to favorites'
            : 'Removed from favorites';
        this.snackBar.open(message, 'Undo', {
          duration: 3000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        }).onAction().subscribe(() => {
          this.favoritesService.toggleFavorite(this.property!.id, userId).subscribe();
        });
      },
    });
  }

  onSubmitAppointment(): void {
    if (this.appointmentForm.invalid || !this.property) return;

    this.submitting = true;
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      this.submitting = false;
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const selectedDate = this.formatAppointmentDate(
      this.appointmentForm.value.date,
    );

    const appointment = {
      propertyId: this.property.id,
      userId: userId,
      sellerId: this.property.sellerId,
      propertyTitle: this.property.title,
      date: selectedDate,
      time: this.appointmentForm.value.time,
      message: this.appointmentForm.value.message || '',
      notes: this.appointmentForm.value.message || '',
    };

    this.appointmentService.createAppointment(appointment).subscribe({
      next: () => {
        this.submitting = false;
        this.appointmentSuccess = true;
        this.appointmentForm.reset();
        this.snackBar.open('Appointment booked successfully!', 'Close', {
          duration: 5000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.submitting = false;
        this.snackBar.open('Failed to book appointment. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  private formatAppointmentDate(value: Date | string): string {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return value;
  }
}
