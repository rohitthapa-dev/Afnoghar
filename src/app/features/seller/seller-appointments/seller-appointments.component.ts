import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  AppointmentService,
  Appointment,
} from '../../../core/services/appointment.service';
import {
  Notification,
  NotificationService,
} from '../../../core/services/notification.service';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';
import { ListingType, PropertyType } from '../../../core/models/property.model';
import { switchMap, of } from 'rxjs';

type AppointmentFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

interface AppointmentTab {
  label: string;
  status: AppointmentFilter;
  icon: string;
}

interface EnrichedAppointment extends Appointment {
  propertyTitle?: string;
  propertyImage?: string;
  propertyLocation?: string;
  propertyPrice?: number;
  propertyType?: PropertyType;
  propertyListingType?: ListingType;
  buyerName?: string;
  isRescheduling?: boolean;
  rescheduleForm?: FormGroup;
}

interface UserSummary {
  id: number;
  name: string;
}

@Component({
  selector: 'app-seller-appointments',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatDialogModule,
    PropertyTypePipe,
  ],
  templateUrl: './seller-appointments.component.html',
  styleUrl: './seller-appointments.component.scss',
})
export class SellerAppointmentsComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  private notificationService = inject(NotificationService);
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private buyerNames = new Map<number, string>();

  readonly appointmentTabs: AppointmentTab[] = [
    { label: 'All', status: 'all', icon: 'event_note' },
    { label: 'Pending', status: 'pending', icon: 'schedule' },
    { label: 'Confirmed', status: 'confirmed', icon: 'verified' },
    { label: 'Cancelled', status: 'cancelled', icon: 'block' },
  ];

  readonly fallbackImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800';
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

  appointments: EnrichedAppointment[] = [];
  notifications: Notification[] = [];
  loading = true;
  error = '';
  selectedTab = 0;
  minRescheduleDate = new Date();

  get sellerId(): number | undefined {
    return this.authService.getCurrentUser()?.id;
  }

  get filteredAppointments(): EnrichedAppointment[] {
    return this.getForStatus(
      this.appointmentTabs[this.selectedTab]?.status || 'all',
    );
  }

  get pendingCount(): number {
    return this.getForStatus('pending').length;
  }
  get confirmedCount(): number {
    return this.getForStatus('confirmed').length;
  }

  get nextTourLabel(): string {
    const next = this.appointments.find(
      (a) => this.normalizeStatus(a.status) !== 'cancelled',
    );
    return next ? this.formatFullDate(next.date) : 'No tours scheduled';
  }

  ngOnInit(): void {
    this.loadAppointments();
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) =>
        (this.notifications = notifications.filter(
          (notification) => !notification.read,
        )),
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
    if (!this.sellerId) {
      this.error = 'Please login to view appointments';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.appointmentService.getAppointments().subscribe({
      next: (all) => {
        const mine = (all as EnrichedAppointment[]).filter(
          (a) => a.sellerId === this.sellerId,
        );
        this.appointments = this.sortAppointments(mine);
        this.enrichAppointments();
        this.loadBuyerNames();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load appointments.';
        this.loading = false;
      },
    });
  }

  accept(appointment: EnrichedAppointment): void {
    this.appointmentService
      .isSlotTaken(
        appointment.propertyId,
        appointment.date,
        appointment.time,
        appointment.id,
      )
      .pipe(
        switchMap((taken) => {
          if (taken) {
            this.snackBar.open(
              'This slot is already booked. Please reschedule.',
              'Close',
              { duration: 4000 },
            );
            return of(null);
          }
          return this.appointmentService.updateAppointment(appointment.id!, {
            status: 'accepted',
          });
        }),
      )
      .subscribe({
        next: (result) => {
          if (!result) return;
          appointment.status = 'accepted';
          this.notify(
            appointment,
            'accepted',
            'Tour Confirmed',
            `Your visit to ${appointment.propertyTitle} on ${this.formatFullDate(appointment.date)} at ${appointment.time} has been confirmed.`,
          );
          this.snackBar.open('Appointment accepted', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  decline(appointment: EnrichedAppointment): void {
    this.appointmentService
      .updateAppointment(appointment.id!, { status: 'declined' })
      .subscribe({
        next: () => {
          appointment.status = 'declined';
          this.notify(
            appointment,
            'declined',
            'Tour Request Declined',
            `Your visit request for ${appointment.propertyTitle} has been declined by the seller.`,
          );
          this.snackBar.open('Appointment declined', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  startReschedule(appointment: EnrichedAppointment): void {
    this.appointments.forEach((a) => {
      a.isRescheduling = false;
      a.rescheduleForm = undefined;
    });

    appointment.isRescheduling = true;
    appointment.rescheduleForm = this.fb.group({
      date: ['', Validators.required],
      time: ['', Validators.required],
    });
  }

  cancelReschedule(appointment: EnrichedAppointment): void {
    appointment.isRescheduling = false;
    appointment.rescheduleForm = undefined;
  }

  submitReschedule(appointment: EnrichedAppointment): void {
    if (!appointment.rescheduleForm?.valid) return;

    const { date, time } = appointment.rescheduleForm.value;
    const formattedDate = this.formatDate(date);

    this.appointmentService
      .isSlotTaken(appointment.propertyId, formattedDate, time, appointment.id)
      .pipe(
        switchMap((taken) => {
          if (taken) {
            this.snackBar.open(
              'That slot is already taken. Choose another.',
              'Close',
              { duration: 4000 },
            );
            return of(null);
          }
          return this.appointmentService.updateAppointment(appointment.id!, {
            date: formattedDate,
            time,
            status: 'pending',
            rescheduledBy: 'seller',
          });
        }),
      )
      .subscribe({
        next: (result) => {
          if (!result) return;
          appointment.date = formattedDate;
          appointment.time = time;
          appointment.status = 'pending';
          appointment.rescheduledBy = 'seller';
          appointment.isRescheduling = false;
          appointment.rescheduleForm = undefined;
          this.notify(
            appointment,
            'rescheduled',
            'Appointment Rescheduled',
            `Your visit to ${appointment.propertyTitle} has been rescheduled to ${this.formatFullDate(formattedDate)} at ${time}.`,
          );
          this.snackBar.open('Appointment rescheduled', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
  }

  getForStatus(status: AppointmentFilter): EnrichedAppointment[] {
    if (status === 'all') return this.appointments;
    return this.appointments.filter(
      (a) => this.normalizeStatus(a.status) === status,
    );
  }

  getTabCount(status: AppointmentFilter): number {
    return this.getForStatus(status).length;
  }

  getStatusClass(status: string): string {
    return `status-${this.normalizeStatus(status as any)}`;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'accepted':
        return 'Confirmed';
      case 'declined':
        return 'Declined';
      case 'completed':
        return 'Completed';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  isPending(a: EnrichedAppointment): boolean {
    return this.normalizeStatus(a.status) === 'pending';
  }

  isConfirmed(a: EnrichedAppointment): boolean {
    return this.normalizeStatus(a.status) === 'confirmed';
  }

  getMonth(date: string): string {
    return this.formatPart(date, { month: 'short' });
  }
  getDay(date: string): string {
    return this.formatPart(date, { day: '2-digit' });
  }

  formatFullDate(date: string): string {
    const d = this.parseDate(date);
    if (!d) return 'Date pending';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }

  getBuyerName(appointment: EnrichedAppointment): string {
    return appointment.buyerName || 'Buyer';
  }

  private notify(
    appointment: EnrichedAppointment,
    type: Notification['type'],
    title: string,
    message: string,
  ): void {
    const buyerId = appointment.buyerId || appointment.userId;
    if (!buyerId) return;

    this.notificationService
      .createNotification({
        userId: buyerId,
        type,
        title,
        message,
        appointmentId: appointment.id!,
        propertyTitle: appointment.propertyTitle || '',
        read: false,
      })
      .subscribe();
  }

  private enrichAppointments(): void {
    this.appointments.forEach((a) => {
      if (!a.propertyId) return;
      this.propertyService.getPropertyById(a.propertyId).subscribe({
        next: (p) => {
          a.propertyTitle = p.title;
          a.propertyImage = p.images?.[0] || this.fallbackImage;
          a.propertyLocation = `${p.location.city}, ${p.location.district}`;
          a.propertyPrice = p.price;
          a.propertyType = p.type;
          a.propertyListingType = p.listingType;
        },
      });
    });
  }

  private loadBuyerNames(): void {
    this.http.get<UserSummary[]>('http://localhost:3000/users').subscribe({
      next: (users) => {
        this.buyerNames = new Map(users.map((user) => [user.id, user.name]));

        this.appointments.forEach((appointment) => {
          const buyerId = appointment.buyerId || appointment.userId;
          if (!buyerId || appointment.buyerName) return;
          appointment.buyerName = this.buyerNames.get(buyerId);
        });
      },
      error: () => {},
    });
  }

  private normalizeStatus(status: string): Exclude<AppointmentFilter, 'all'> {
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

  private sortAppointments(list: EnrichedAppointment[]): EnrichedAppointment[] {
    return [...list].sort(
      (a, b) => this.getTimestamp(a) - this.getTimestamp(b),
    );
  }

  private getTimestamp(a: EnrichedAppointment): number {
    const d = this.parseDate(a.date);
    if (!d) return Number.MAX_SAFE_INTEGER;
    const { hours, minutes } = this.parseTime(a.time);
    d.setHours(hours, minutes, 0, 0);
    return d.getTime();
  }

  private parseDate(date: string): Date | null {
    if (!date) return null;
    const parts = date.split('-').map(Number);
    if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }

  private parseTime(time: string): { hours: number; minutes: number } {
    const m = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    if (!m) return { hours: 9, minutes: 0 };
    let h = Number(m[1]);
    const min = Number(m[2]);
    const mer = m[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return { hours: h, minutes: min };
  }

  private formatPart(
    date: string,
    options: Intl.DateTimeFormatOptions,
  ): string {
    const d = this.parseDate(date);
    if (!d) return '--';
    return new Intl.DateTimeFormat('en-US', options).format(d);
  }

  private formatDate(value: Date | string): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return value;
  }
}
