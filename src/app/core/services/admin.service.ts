import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';

export type AdminUserUpdate = Partial<
  Pick<User, 'name' | 'email' | 'phone' | 'role' | 'isActive'>
>;

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  updateUser(id: number, payload: AdminUserUpdate): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}`, payload);
  }

  getProperties(): Observable<Property[]> {
    return this.http.get<Property[]>(`${this.apiUrl}/properties`);
  }

  updateProperty(
    id: number,
    payload: Partial<Property>,
  ): Observable<Property> {
    return this.http.patch<Property>(`${this.apiUrl}/properties/${id}`, payload);
  }

  deleteProperty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/properties/${id}`);
  }
}
