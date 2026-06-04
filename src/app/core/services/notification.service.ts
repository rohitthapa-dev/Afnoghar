import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: number;
  userId: number;
  type: 'accepted' | 'declined' | 'rescheduled' | 'booked' | 'cancelled' | 'property_submitted' | 'property_approved' | 'property_rejected';
  title: string;
  message: string;
  appointmentId?: number;
  propertyId?: number;
  propertyTitle: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);

  notifications$ = this.notificationsSubject.asObservable();

  getNotifications(): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(`${this.apiUrl}/notifications`)
      .pipe(
        tap((notifications) => this.notificationsSubject.next(notifications)),
      );
  }

  createNotification(payload: Partial<Notification>): Observable<Notification> {
    return this.http.post<Notification>(
      `${this.apiUrl}/notifications`,
      payload,
    );
  }

  markRead(id: number): Observable<Notification> {
    return this.http
      .patch<Notification>(`${this.apiUrl}/notifications/${id}`, {
        read: true,
      })
      .pipe(
        tap((updatedNotification) => {
          this.notificationsSubject.next(
            this.notificationsSubject.value.map((notification) =>
              notification.id === id ? updatedNotification : notification,
            ),
          );
        }),
      );
  }

  clearNotifications(): void {
    this.notificationsSubject.next([]);
  }
}
