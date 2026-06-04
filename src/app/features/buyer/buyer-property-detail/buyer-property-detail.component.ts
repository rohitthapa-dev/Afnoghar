import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Property } from '../../../core/models/property.model';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';
import { environment } from '../../../../environments/environment';
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
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

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
  unavailableSlots = new Set<string>();
  readonly timeSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM',
    '05:00 PM',
  ];

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

  get isOwner(): boolean {
    const currentUserId = this.authService.getCurrentUser()?.id;
    return !!currentUserId && this.property?.sellerId === currentUserId;
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
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (!id || isNaN(id)) {
          this.error = 'Invalid property ID';
          this.loading = false;
          return;
        }

        this.loadProperty(id);
      });

    this.appointmentForm
      .get('date')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshUnavailableSlots();
        this.clearUnavailableSelectedTime();
      });
  }

  private loadProperty(id: number): void {
    this.loading = true;
    this.error = '';
    this.property = undefined;
    this.currentImageIndex = 0;
    this.sellerName = '';
    this.sellerPhone = '';
    this.sellerEmail = '';
    this.appointmentSuccess = false;
    this.unavailableSlots = new Set();

    this.propertyService.getPropertyById(id).subscribe({
      next: (property) => {
        this.property = property;
        this.loading = false;
        this.loadSellerInfo(property.sellerId);
        this.refreshUnavailableSlots();
      },
      error: () => {
        this.error = 'Failed to load property details. Please try again.';
        this.loading = false;
      },
    });
  }

  private loadSellerInfo(sellerId: number): void {
    this.http.get<any[]>(`${environment.apiUrl}/agents`).subscribe({
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

  editOwnListing(): void {
    if (!this.property) return;
    this.router.navigate(['/seller/properties', this.property.id, 'edit']);
  }

  goToMyListings(): void {
    this.router.navigate(['/seller/properties']);
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
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser?.id;
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
    const selectedTime = this.appointmentForm.value.time;

    if (this.isTimeSlotUnavailable(selectedTime)) {
      this.submitting = false;
      this.appointmentForm.get('time')?.setErrors({ slotTaken: true });
      this.snackBar.open(
        'This time slot is already full. Please choose another time.',
        'Close',
        {
          duration: 4000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        },
      );
      return;
    }

    const appointment = {
      propertyId: this.property.id,
      userId: userId,
      sellerId: this.property.sellerId,
      propertyTitle: this.property.title,
      buyerName: currentUser?.name || '',
      date: selectedDate,
      time: selectedTime,
      message: this.appointmentForm.value.message || '',
      notes: this.appointmentForm.value.message || '',
    };

    this.appointmentService.createAppointment(appointment).subscribe({
      next: (createdAppointment) => {
        this.submitting = false;
        this.appointmentSuccess = true;
        this.appointmentForm.reset();
        this.notifySellerOfBooking(
          createdAppointment.id,
          selectedDate,
          selectedTime,
        );
        this.snackBar.open('Appointment booked successfully!', 'Close', {
          duration: 5000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: (errorResponse) => {
        this.submitting = false;
        this.refreshUnavailableSlots();
        this.snackBar.open(
          errorResponse?.error?.message ||
            'Failed to book appointment. Please try again.',
          'Close',
          {
            duration: 5000,
            horizontalPosition: 'start',
            verticalPosition: 'bottom',
          },
        );
      },
    });
  }

  isTimeSlotUnavailable(time: string): boolean {
    const date = this.getSelectedAppointmentDate();
    if (!date || !time) return false;
    return this.unavailableSlots.has(`${date}|${time}`);
  }

  private refreshUnavailableSlots(): void {
    if (!this.property) return;
    const date = this.getSelectedAppointmentDate();
    if (!date) {
      this.unavailableSlots = new Set();
      return;
    }

    this.appointmentService.getAppointments({
      propertyId: this.property.id,
      date,
    }).subscribe({
      next: (appointments) => {
        const unavailable = appointments
          .filter(
            (appointment) =>
              appointment.propertyId === this.property!.id &&
              appointment.date === date &&
              this.isHoldingAppointmentStatus(appointment.status),
          )
          .map((appointment) => `${appointment.date}|${appointment.time}`);

        this.unavailableSlots = new Set(unavailable);
        this.clearUnavailableSelectedTime();
      },
      error: () => {
        this.unavailableSlots = new Set();
      },
    });
  }

  private clearUnavailableSelectedTime(): void {
    const selectedTime = this.appointmentForm.get('time')?.value;
    if (!selectedTime || !this.isTimeSlotUnavailable(selectedTime)) return;
    this.appointmentForm.get('time')?.reset();
  }

  private getSelectedAppointmentDate(): string {
    const value = this.appointmentForm.get('date')?.value;
    return value ? this.formatAppointmentDate(value) : '';
  }

  private isHoldingAppointmentStatus(status: string): boolean {
    return !['cancelled', 'declined', 'completed'].includes(status);
  }

  private notifySellerOfBooking(
    appointmentId: number | undefined,
    date: string,
    time: string,
  ): void {
    if (!this.property || !appointmentId) return;

    const buyerName =
      this.authService.getCurrentUser()?.name || 'A buyer';

    this.notificationService
      .createNotification({
        userId: this.property.sellerId,
        type: 'booked',
        title: 'New Tour Request',
        message: `${buyerName} requested a tour for ${this.property.title} on ${this.formatAppointmentLabel(date)} at ${time}.`,
        appointmentId,
        propertyTitle: this.property.title,
        read: false,
      })
      .subscribe();
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

  private formatAppointmentLabel(date: string): string {
    const parts = date.split('-').map(Number);
    const parsed =
      parts.length === 3 && parts.every((part) => !Number.isNaN(part))
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : new Date(date);

    if (Number.isNaN(parsed.getTime())) return 'the selected date';

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }
}
