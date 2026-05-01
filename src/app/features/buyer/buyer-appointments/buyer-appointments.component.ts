import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AppointmentService,
  Appointment,
} from '../../../core/services/appointment.service';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Notification,
  NotificationService,
} from '../../../core/services/notification.service';

import { ListingType, PropertyType } from '../../../core/models/property.model';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

type AppointmentStatus = Appointment['status'] | 'accepted' | 'declined';
type AppointmentFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

interface AppointmentWithProperty extends Omit<Appointment, 'status'> {
  status: AppointmentStatus;
  buyerId?: number;
  sellerId?: number;
  message?: string;
  propertyTitle?: string;
  propertyImage?: string;
  propertyLocation?: string;
  propertyPrice?: number;
  propertyType?: PropertyType;
  propertyListingType?: ListingType;
  sellerName?: string;
}

interface AppointmentTab {
  label: string;
  status: AppointmentFilter;
  icon: string;
}

interface UserSummary {
  id: number;
  name: string;
}

@Component({
  selector: 'app-buyer-appointments',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule,
    MatSnackBarModule,
    PriceFormatPipe,
    PropertyTypePipe,
  ],
  templateUrl: './buyer-appointments.component.html',
  styleUrl: './buyer-appointments.component.scss',
})
export class BuyerAppointmentsComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private snackBar = inject(MatSnackBar);
  private http = inject(HttpClient);
  private sellerNames = new Map<number, string>();
  private sellerRescheduledAppointmentIds = new Set<number>();
  readonly appointmentTabs: AppointmentTab[] = [
    { label: 'All', status: 'all', icon: 'event_note' },
    { label: 'Pending', status: 'pending', icon: 'schedule' },
    { label: 'Confirmed', status: 'confirmed', icon: 'verified' },
    { label: 'Cancelled', status: 'cancelled', icon: 'block' },
  ];

  readonly fallbackImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800';

  appointments: AppointmentWithProperty[] = [];
  notifications: Notification[] = [];

  loading = true;
  error = '';
  selectedTab = 0;

  get userId(): number | undefined {
    return this.authService.getCurrentUser()?.id;
  }

  get selectedFilter(): AppointmentFilter {
    return this.appointmentTabs[this.selectedTab]?.status || 'all';
  }

  get filteredAppointments(): AppointmentWithProperty[] {
    return this.getAppointmentsForStatus(this.selectedFilter);
  }

  get pendingCount(): number {
    return this.getTabCount('pending');
  }

  get confirmedCount(): number {
    return this.getTabCount('confirmed');
  }

  get nextAppointmentLabel(): string {
    const nextAppointment = this.appointments.find(
      (a) => this.normalizeStatus(a.status) !== 'cancelled',
    );

    return nextAppointment
      ? this.formatFullDate(nextAppointment.date)
      : 'No tours scheduled';
  }

  ngOnInit(): void {
    this.loadAppointments();
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.sellerRescheduledAppointmentIds = new Set(
          notifications
            .filter((notification) => notification.type === 'rescheduled')
            .map((notification) => notification.appointmentId),
        );
        this.applyRescheduleHints();
        this.notifications = notifications.filter(
          (notification) => !notification.read,
        );
      },
      error: () => {},
    });
  }

  dismissNotification(id: number): void {
    this.notificationService.markRead(id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((n) => n.id !== id);
      },
    });
  }

  getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'accepted':
        return 'check_circle';
      case 'declined':
      case 'cancelled':
        return 'cancel';
      case 'booked':
        return 'event_available';
      default:
        return 'edit_calendar';
    }
  }

  loadAppointments(): void {
    if (!this.userId) {
      this.error = 'Please login to view your appointments';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';

    this.appointmentService.getAppointments().subscribe({
      next: (appointments) => {
        const userAppointments = (
          appointments as AppointmentWithProperty[]
        ).filter((a) => a.userId === this.userId || a.buyerId === this.userId);

        this.appointments = this.sortAppointments(userAppointments);
        this.applyRescheduleHints();
        this.loadPropertyDetails();
        this.loadSellerNames();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load appointments. Please try again.';
        this.loading = false;
      },
    });
  }

  cancelAppointment(id: number | undefined): void {
    if (!id) return;

    this.appointmentService
      .updateAppointment(id, { status: 'cancelled' })
      .subscribe({
        next: () => {
          const appointment = this.appointments.find((a) => a.id === id);
          if (appointment) {
            appointment.status = 'cancelled';
            this.notifySeller(
              appointment,
              'cancelled',
              'Tour Cancelled',
              `The buyer cancelled the tour for ${this.getPropertyTitle(appointment)} on ${this.formatFullDate(appointment.date)} at ${appointment.time}.`,
            );
          }

          this.snackBar.open('Appointment cancelled successfully', 'Close', {
            duration: 3000,
            horizontalPosition: 'start',
            verticalPosition: 'bottom',
          });
        },
        error: () => {
          this.snackBar.open('Failed to cancel appointment', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  confirmAppointment(appointment: AppointmentWithProperty): void {
    if (!appointment.id || !this.isConfirmable(appointment)) return;

    this.appointmentService
      .updateAppointment(appointment.id, {
        status: 'accepted',
        rescheduledBy: 'buyer',
      })
      .subscribe({
        next: () => {
          appointment.status = 'accepted';
          appointment.rescheduledBy = 'buyer';
          this.notifySeller(
            appointment,
            'accepted',
            'Tour Time Confirmed',
            `The buyer confirmed the rescheduled tour for ${this.getPropertyTitle(appointment)} on ${this.formatFullDate(appointment.date)} at ${appointment.time}.`,
          );

          this.snackBar.open('Appointment confirmed successfully', 'Close', {
            duration: 3000,
            horizontalPosition: 'start',
            verticalPosition: 'bottom',
          });
        },
        error: () => {
          this.snackBar.open('Failed to confirm appointment', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
  }

  getAppointmentsForStatus(
    status: AppointmentFilter,
  ): AppointmentWithProperty[] {
    if (status === 'all') return this.appointments;

    return this.appointments.filter(
      (a) => this.normalizeStatus(a.status) === status,
    );
  }

  getTabCount(status: AppointmentFilter): number {
    return this.getAppointmentsForStatus(status).length;
  }

  getStatusClass(status: AppointmentStatus): string {
    return `status-${this.normalizeStatus(status)}`;
  }

  getStatusLabel(status: AppointmentStatus): string {
    switch (status) {
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

  getAppointmentMonth(date: string): string {
    return this.formatDatePart(date, { month: 'short' });
  }

  getAppointmentDay(date: string): string {
    return this.formatDatePart(date, { day: '2-digit' });
  }

  formatFullDate(date: string): string {
    const parsed = this.parseDate(date);
    if (!parsed) return 'Date pending';

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }

  getAppointmentMessage(appointment: AppointmentWithProperty): string {
    return (appointment.notes || appointment.message || '').trim();
  }

  getSellerName(appointment: AppointmentWithProperty): string {
    return appointment.sellerName || 'Verified seller';
  }

  isCancelable(appointment: AppointmentWithProperty): boolean {
    return (
      appointment.status === 'pending' ||
      appointment.status === 'accepted' ||
      appointment.status === 'confirmed'
    );
  }

  isConfirmable(appointment: AppointmentWithProperty): boolean {
    return (
      appointment.status === 'pending' && appointment.rescheduledBy === 'seller'
    );
  }

  private normalizeStatus(
    status: AppointmentStatus,
  ): Exclude<AppointmentFilter, 'all'> {
    switch (status) {
      case 'accepted':
      case 'confirmed':
      case 'completed':
        return 'confirmed';
      case 'declined':
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private sortAppointments(apps: AppointmentWithProperty[]) {
    return [...apps].sort(
      (a, b) =>
        this.getAppointmentTimestamp(a) - this.getAppointmentTimestamp(b),
    );
  }

  private getAppointmentTimestamp(a: AppointmentWithProperty) {
    const date = this.parseDate(a.date);
    if (!date) return Number.MAX_SAFE_INTEGER;

    const { hours, minutes } = this.parseTime(a.time);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  }

  private parseDate(date: string): Date | null {
    if (!date) return null;

    const parts = date.split('-').map(Number);
    if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseTime(time: string): { hours: number; minutes: number } {
    const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    if (!match) return { hours: 9, minutes: 0 };

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  }

  private formatDatePart(
    date: string,
    options: Intl.DateTimeFormatOptions,
  ): string {
    const parsed = this.parseDate(date);
    if (!parsed) return '--';

    return new Intl.DateTimeFormat('en-US', options).format(parsed);
  }

  private notifySeller(
    appointment: AppointmentWithProperty,
    type: Notification['type'],
    title: string,
    message: string,
  ): void {
    if (!appointment.sellerId || !appointment.id) return;

    this.notificationService
      .createNotification({
        userId: appointment.sellerId,
        type,
        title,
        message,
        appointmentId: appointment.id,
        propertyTitle: this.getPropertyTitle(appointment),
        read: false,
      })
      .subscribe();
  }

  private getPropertyTitle(appointment: AppointmentWithProperty): string {
    return appointment.propertyTitle || `Property #${appointment.propertyId}`;
  }

  private applyRescheduleHints(): void {
    this.appointments.forEach((appointment) => {
      if (
        appointment.id &&
        appointment.status === 'pending' &&
        !appointment.rescheduledBy &&
        this.sellerRescheduledAppointmentIds.has(appointment.id)
      ) {
        appointment.rescheduledBy = 'seller';
      }
    });
  }

  private loadSellerNames(): void {
    this.http.get<UserSummary[]>('http://localhost:3000/agents').subscribe({
      next: (sellers) => {
        this.sellerNames = new Map(
          sellers.map((seller) => [seller.id, seller.name]),
        );

        this.appointments.forEach((appointment) => {
          if (!appointment.sellerId) return;
          appointment.sellerName = this.sellerNames.get(appointment.sellerId);
        });
      },
      error: () => {},
    });
  }

  private loadPropertyDetails(): void {
    this.appointments.forEach((a) => {
      if (!a.propertyId) return;

      this.propertyService.getPropertyById(a.propertyId).subscribe({
        next: (p) => {
          a.propertyTitle = p.title;
          a.sellerId = a.sellerId || p.sellerId;
          a.sellerName = a.sellerName || this.sellerNames.get(p.sellerId);
          a.propertyImage = p.images?.[0] || this.fallbackImage;
          a.propertyLocation = `${p.location.city}, ${p.location.district}`;
          a.propertyPrice = p.price;
          a.propertyType = p.type;
          a.propertyListingType = p.listingType;
        },
        error: () => {
          a.propertyTitle = 'Property not found';
        },
      });
    });
  }
}
