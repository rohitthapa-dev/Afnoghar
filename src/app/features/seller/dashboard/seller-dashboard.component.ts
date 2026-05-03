import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  Appointment,
  AppointmentService,
} from '../../../core/services/appointment.service';
import { Property } from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyService } from '../../../core/services/property.service';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

@Component({
  selector: 'app-seller-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PriceFormatPipe,
    PropertyTypePipe,
  ],
  templateUrl: './seller-dashboard.component.html',
  styleUrl: './seller-dashboard.component.scss',
})
export class SellerDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private propertyService = inject(PropertyService);
  private appointmentService = inject(AppointmentService);

  readonly properties = signal<Property[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly sellerName = computed(
    () => this.authService.getCurrentUser()?.name || 'Seller',
  );

  readonly approvedListings = computed(() =>
    this.properties().filter((property) => property.status === 'approved'),
  );
  readonly pendingListings = computed(() =>
    this.properties().filter((property) => property.status === 'pending'),
  );
  readonly rejectedListings = computed(() =>
    this.properties().filter((property) => property.status === 'rejected'),
  );
  readonly pendingAppointments = computed(() =>
    this.appointments().filter((appointment) => appointment.status === 'pending'),
  );
  readonly confirmedAppointments = computed(() =>
    this.appointments().filter((appointment) =>
      ['accepted', 'confirmed', 'completed'].includes(appointment.status),
    ),
  );
  readonly awaitingBuyerAppointments = computed(() =>
    this.appointments().filter(
      (appointment) =>
        appointment.status === 'pending' &&
        appointment.rescheduledBy === 'seller',
    ),
  );
  readonly portfolioValue = computed(() =>
    this.properties().reduce((sum, property) => sum + property.price, 0),
  );

  readonly recentListings = computed(() => this.properties().slice(0, 3));
  readonly recentAppointments = computed(() =>
    [...this.appointments()]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, 4),
  );

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    const sellerId = this.authService.getCurrentUser()?.id;

    if (!sellerId) {
      this.error.set('Please login to view your dashboard.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      properties: this.propertyService.getProperties(),
      appointments: this.appointmentService.getAppointments(),
    }).subscribe({
      next: ({ properties, appointments }) => {
        this.properties.set(
          properties
            .filter((property) => property.sellerId === sellerId)
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime(),
            ),
        );
        this.appointments.set(
          appointments.filter(
            (appointment) => appointment.sellerId === sellerId,
          ),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load dashboard right now.');
        this.loading.set(false);
      },
    });
  }

  getAppointmentStatusLabel(appointment: Appointment): string {
    if (
      appointment.status === 'pending' &&
      appointment.rescheduledBy === 'seller'
    ) {
      return 'Awaiting Buyer';
    }

    switch (appointment.status) {
      case 'accepted':
      case 'confirmed':
        return 'Confirmed';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      default:
        return 'Pending';
    }
  }

  getAppointmentStatusClass(appointment: Appointment): string {
    if (
      appointment.status === 'pending' &&
      appointment.rescheduledBy === 'seller'
    ) {
      return 'status-awaiting';
    }

    if (['accepted', 'confirmed', 'completed'].includes(appointment.status)) {
      return 'status-approved';
    }

    if (['declined', 'cancelled'].includes(appointment.status)) {
      return 'status-rejected';
    }

    return 'status-pending';
  }

  formatDate(date: string): string {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Date pending';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }
}
