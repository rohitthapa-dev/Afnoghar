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
  AppointmentActor,
  AppointmentStatus,
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

type AppointmentFilter =
  | 'all'
  | AppointmentStatus.Pending
  | AppointmentStatus.Confirmed
  | AppointmentStatus.Cancelled;

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
  private readonly appointmentService = inject(AppointmentService);
  private readonly propertyService = inject(PropertyService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly http = inject(HttpClient);
  private sellerNames = new Map<number, string>();
  private sellerRescheduledAppointmentIds = new Set<number>();
  readonly appointmentTabs: AppointmentTab[] = [
    { label: 'All', status: 'all', icon: 'event_note' },
    { label: 'Pending', status: AppointmentStatus.Pending, icon: 'schedule' },
    { label: 'Confirmed', status: AppointmentStatus.Confirmed, icon: 'verified' },
    { label: 'Cancelled', status: AppointmentStatus.Cancelled, icon: 'block' },
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
    return this.getTabCount(AppointmentStatus.Pending);
  }

  get confirmedCount(): number {
    return this.getTabCount(AppointmentStatus.Confirmed);
  }

  get nextAppointmentLabel(): string {
    const nextAppointment = this.appointments.find(
      (a) => this.normalizeStatus(a.status) !== AppointmentStatus.Cancelled,
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
            .map((notification) => notification.appointmentId)
            .filter((id): id is number => id !== undefined),
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
      .updateAppointment(id, { status: AppointmentStatus.Cancelled })
      .subscribe({
        next: () => {
          const appointment = this.appointments.find((a) => a.id === id);
          if (appointment) {
            appointment.status = AppointmentStatus.Cancelled;
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
        status: AppointmentStatus.Accepted,
        rescheduledBy: AppointmentActor.Buyer,
      })
      .subscribe({
        next: () => {
          appointment.status = AppointmentStatus.Accepted;
          appointment.rescheduledBy = AppointmentActor.Buyer;
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
      case AppointmentStatus.Accepted:
      case AppointmentStatus.Confirmed:
        return 'Confirmed';
      case AppointmentStatus.Declined:
        return 'Declined';
      case AppointmentStatus.Cancelled:
        return 'Cancelled';
      case AppointmentStatus.Completed:
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
      appointment.status === AppointmentStatus.Pending ||
      appointment.status === AppointmentStatus.Accepted ||
      appointment.status === AppointmentStatus.Confirmed
    );
  }

  isConfirmable(appointment: AppointmentWithProperty): boolean {
    return (
      appointment.status === AppointmentStatus.Pending &&
      appointment.rescheduledBy === AppointmentActor.Seller
    );
  }

  private normalizeStatus(
    status: AppointmentStatus,
  ): Exclude<AppointmentFilter, 'all'> {
    switch (status) {
      case AppointmentStatus.Accepted:
      case AppointmentStatus.Confirmed:
      case AppointmentStatus.Completed:
        return AppointmentStatus.Confirmed;
      case AppointmentStatus.Declined:
      case AppointmentStatus.Cancelled:
        return AppointmentStatus.Cancelled;
      default:
        return AppointmentStatus.Pending;
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
        appointment.status === AppointmentStatus.Pending &&
        !appointment.rescheduledBy &&
        this.sellerRescheduledAppointmentIds.has(appointment.id)
      ) {
        appointment.rescheduledBy = AppointmentActor.Seller;
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
