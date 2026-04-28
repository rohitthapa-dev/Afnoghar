import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { PropertyService } from '../../../core/services/property.service';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Property } from '../../../core/models/property.model';
import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';

interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  rating: number;
  propertiesSold: number;
  experience: string;
}

@Component({
  selector: 'app-buyer-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-home.component.html',
  styleUrl: './buyer-home.component.scss',
})
export class BuyerHomeComponent implements OnInit {
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  featuredProperties: Property[] = [];
  agents: Agent[] = [];
  loading = true;
  error = '';

  private apiUrl = 'http://localhost:3000';

  ngOnInit(): void {
    this.loadFeaturedProperties();
    this.loadAgents();
  }

  loadFeaturedProperties(): void {
    this.loading = true;
    this.error = '';

    this.propertyService.getFeaturedProperties(6).subscribe({
      next: (properties) => {
        this.featuredProperties = properties;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load properties. Please try again.';
        this.loading = false;
      },
    });
  }
  loadAgents(): void {
    this.http.get<any[]>(`${this.apiUrl}/agents`).subscribe({
      next: (users) => {
        this.agents = users.slice(0, 3).map((user) => ({
          ...user,
          rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
          propertiesSold: Math.floor(Math.random() * 20) + 5,
          experience: `${Math.floor(Math.random() * 10) + 2} years`,
        }));
      },
      error: () => {
        this.agents = [];
      },
    });
  }

  onSearchProperties(): void {
    this.router.navigate(['/buyer/properties']);
  }

  getAgentInitials(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
