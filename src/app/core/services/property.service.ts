import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { Property } from '../models/property.model';

@Injectable({
  providedIn: 'root',
})
export class PropertyService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getProperties(): Observable<Property[]> {
    return this.http.get<Property[]>(`${this.apiUrl}/properties`);
  }

  getPropertyById(id: number): Observable<Property> {
    return this.http.get<Property>(`${this.apiUrl}/properties/${id}`);
  }

  createProperty(property: Partial<Property>): Observable<Property> {
    return this.http.post<Property>(`${this.apiUrl}/properties`, property);
  }

  updateProperty(
    id: number,
    property: Partial<Property>,
  ): Observable<Property> {
    return this.http.patch<Property>(
      `${this.apiUrl}/properties/${id}`,
      property,
    );
  }

  deleteProperty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/properties/${id}`);
  }

  getFeaturedProperties(limit: number = 6): Observable<Property[]> {
    return this.http
      .get<Property[]>(`${this.apiUrl}/properties`)
      .pipe(
        map((properties) =>
          properties
            .filter((p) => p.status === 'approved' && p.isFeatured === true)
            .slice(0, limit),
        ),
      );
  }

  getApprovedProperties(): Observable<Property[]> {
    return this.http
      .get<Property[]>(`${this.apiUrl}/properties`)
      .pipe(
        map((properties) => properties.filter((p) => p.status === 'approved')),
      );
  }

  getPropertiesByIds(ids: number[]): Observable<Property[]> {
    if (ids.length === 0) return of([]);
    return this.http
      .get<Property[]>(`${this.apiUrl}/properties`)
      .pipe(
        map((properties) =>
          properties.filter((p) => ids.includes(p.id) && p.status === 'approved')
        ),
      );
  }
}
