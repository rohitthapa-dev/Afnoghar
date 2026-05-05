import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Appointment {
  id?: number;
  propertyId: number;
  userId?: number;
  buyerId?: number;
  sellerId?: number;
  propertyTitle?: string;
  buyerName?: string;
  sellerName?: string;
  date: string;
  time: string;
  message?: string;
  notes?: string;
  rescheduledBy?: 'buyer' | 'seller';

  status:
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'cancelled'
    | 'confirmed'
    | 'completed';

  createdAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';
  getAppointments(filters?: {
    propertyId?: number;
    date?: string;
  }): Observable<Appointment[]> {
    let params = new HttpParams();

    if (filters?.propertyId) {
      params = params.set('propertyId', filters.propertyId);
    }

    if (filters?.date) {
      params = params.set('date', filters.date);
    }

    return this.http.get<Appointment[]>(`${this.apiUrl}/appointments`, {
      params,
    });
  }

  getAppointmentById(id: number): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.apiUrl}/appointments/${id}`);
  }

  createAppointment(
    appointment: Partial<Appointment>,
  ): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${this.apiUrl}/appointments`,
      appointment,
    );
  }

  updateAppointment(
    id: number,
    appointment: Partial<Appointment>,
  ): Observable<Appointment> {
    return this.http.patch<Appointment>(
      `${this.apiUrl}/appointments/${id}`,
      appointment,
    );
  }

  deleteAppointment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/appointments/${id}`);
  }

  isSlotTaken(
    propertyId: number,
    date: string,
    time: string,
    excludeId?: number,
  ): Observable<boolean> {
    return this.getAppointments({ propertyId, date }).pipe(
      map((appointments) =>
        appointments.some(
          (a) =>
            a.propertyId === propertyId &&
            a.date === date &&
            a.time === time &&
            a.status !== 'cancelled' &&
            a.status !== 'declined' &&
            a.id !== excludeId,
        ),
      ),
    );
  }
}
