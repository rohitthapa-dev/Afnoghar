import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Favorite {
  id?: number;
  userId: number;
  propertyId: number;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getFavorites(): Observable<Favorite[]> {
    return this.http.get<Favorite[]>(`${this.apiUrl}/favorites`);
  }

  addFavorite(propertyId: number, userId: number): Observable<Favorite> {
    return this.http.post<Favorite>(`${this.apiUrl}/favorites`, {
      propertyId,
      userId,
    });
  }

  removeFavorite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/favorites/${id}`);
  }

  checkFavorite(propertyId: number, userId: number): Observable<Favorite[]> {
    return this.http.get<Favorite[]>(
      `${this.apiUrl}/favorites?propertyId=${propertyId}&userId=${userId}`,
    );
  }
}
