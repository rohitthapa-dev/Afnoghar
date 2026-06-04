import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, switchMap, of, throwError, map } from 'rxjs';
import { Property } from '../models/property.model';
import { PropertyService } from './property.service';
import { environment } from '../../../environments/environment';

export interface Favorite {
  id?: number;
  buyerId: number;
  propertyId: number;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private propertyService = inject(PropertyService);
  private apiUrl = environment.apiUrl;

  private favorites = signal<Favorite[]>([]);

  favoriteIds = computed(() => this.favorites().map(f => f.propertyId));
  favoritesCount = computed(() => this.favorites().length);

  loadFavorites(userId: number): Observable<Favorite[]> {
    if (!userId) {
      this.clearFavorites();
      return of([]);
    }

    return this.http
      .get<Favorite[]>(`${this.apiUrl}/favorites?buyerId=${userId}`)
      .pipe(tap((favorites: Favorite[]) => this.favorites.set(favorites)));
  }

  getFavoriteProperties(userId: number): Observable<Property[]> {
    if (!userId) return of([]);

    return this.loadFavorites(userId)
      .pipe(
        map((favorites: Favorite[]) => favorites.map(f => f.propertyId)),
        switchMap((propertyIds: number[]) => {
          if (propertyIds.length === 0) return of([]);
          return this.propertyService.getPropertiesByIds(propertyIds);
        }),
      );
  }

  isFavorite(propertyId?: number): boolean {
    if (!propertyId) return false;
    return this.favoriteIds().includes(propertyId);
  }

  toggleFavorite(propertyId: number, userId: number): Observable<{ action: 'added' | 'removed'; favorite?: Favorite }> {
    if (!userId) return throwError(() => new Error('User not logged in'));
    if (!propertyId) return throwError(() => new Error('Property is required'));

    const existing = this.favorites().find(
      f => f.propertyId === propertyId && f.buyerId === userId
    );

    if (existing) {
      return this.http.delete<void>(`${this.apiUrl}/favorites/${existing.id}`).pipe(
        tap(() => {
          this.favorites.update(favs => favs.filter(f => f.id !== existing.id));
        }),
        map(() => ({ action: 'removed' as const })),
      );
    }

    return this.http
      .post<Favorite>(`${this.apiUrl}/favorites`, {
        buyerId: userId,
        propertyId,
      })
      .pipe(
        tap((favorite: Favorite) => {
          this.favorites.update(favs => {
            const alreadyExists = favs.some(
              f =>
                f.id === favorite.id ||
                (f.buyerId === favorite.buyerId &&
                  f.propertyId === favorite.propertyId)
            );

            return alreadyExists ? favs : [...favs, favorite];
          });
        }),
        map((favorite: Favorite) => ({ action: 'added' as const, favorite })),
      );
  }

  removeFavoriteByPropertyId(propertyId: number): Observable<void> {
    const existing = this.favorites().find(f => f.propertyId === propertyId);

    if (!existing) return of(undefined as void);

    return this.http.delete<void>(`${this.apiUrl}/favorites/${existing.id}`).pipe(
      tap(() => {
        this.favorites.update(favs => favs.filter(f => f.id !== existing.id));
      }),
    );
  }

  clearFavorites(): void {
    this.favorites.set([]);
  }
}
