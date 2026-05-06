import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Property } from '../models/property.model';

@Injectable({
  providedIn: 'root',
})
export class AiBuyerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/ai/buyer-chat';

  ask(message: string) {
    return this.http.post<{
      reply: string;
      filters: any;
      properties: Property[];
    }>(this.apiUrl, { message });
  }
}
