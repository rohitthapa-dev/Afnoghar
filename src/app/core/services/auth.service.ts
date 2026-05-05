import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import {
  User,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
} from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:3000';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem('afnoghar_user');
    const storedToken = localStorage.getItem('afnoghar_token');

    if (storedUser && storedToken) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((response) => {
          if (response.success && response.token) {
            localStorage.setItem('afnoghar_token', response.token);
            localStorage.setItem(
              'afnoghar_user',
              JSON.stringify(response.user),
            );
            this.currentUserSubject.next(response.user);
          }
        }),
      );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, payload)
      .pipe(
        tap((response) => {
          if (response.success && response.token) {
            localStorage.setItem('afnoghar_token', response.token);
            localStorage.setItem(
              'afnoghar_user',
              JSON.stringify(response.user),
            );
            this.currentUserSubject.next(response.user);
          }
        }),
      );
  }

  logout(): void {
    localStorage.removeItem('afnoghar_token');
    localStorage.removeItem('afnoghar_user');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem('afnoghar_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.currentUserSubject.value;
  }

  getRole(): string | null {
    return this.currentUserSubject.value?.role || null;
  }

  isBuyer(): boolean {
    return this.getRole() === 'buyer';
  }

  isSeller(): boolean {
    return this.getRole() === 'seller';
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  hasRole(roles: string[]): boolean {
    const userRole = this.getRole();
    return userRole ? roles.includes(userRole) : false;
  }

  updateCurrentUser(user: any): void {
    localStorage.setItem('afnoghar_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  updateProfile(payload: {
    name?: string;
    phone?: string;
    password?: string;
    currentPassword?: string;
  }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/users/me`, payload);
  }

  uploadAvatar(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/me/avatar`, formData);
  }

  deleteAccount(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/users/me`);
  }
}
