import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Property, PropertyStatus } from '../../../core/models/property.model';
import { User } from '../../../core/models/user.model';
import { AdminService } from '../../../core/services/admin.service';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PriceFormatPipe,
    PropertyTypePipe,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);

  readonly users = signal<User[]>([]);
  readonly properties = signal<Property[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly activeUsers = computed(() =>
    this.users().filter((user) => user.isActive),
  );
  readonly buyers = computed(() =>
    this.users().filter((user) => user.role === 'buyer'),
  );
  readonly sellers = computed(() =>
    this.users().filter((user) => user.role === 'seller'),
  );
  readonly pendingListings = computed(() =>
    this.properties().filter((property) => property.status === 'pending'),
  );
  readonly approvedListings = computed(() =>
    this.properties().filter((property) => property.status === 'approved'),
  );
  readonly rejectedListings = computed(() =>
    this.properties().filter((property) => property.status === 'rejected'),
  );
  readonly featuredListings = computed(() =>
    this.properties().filter((property) => property.isFeatured),
  );
  readonly marketplaceValue = computed(() =>
    this.approvedListings().reduce((sum, property) => sum + property.price, 0),
  );
  readonly pendingReviewPreview = computed(() =>
    this.pendingListings()
      .sort((a, b) => this.toTime(b.createdAt) - this.toTime(a.createdAt))
      .slice(0, 4),
  );
  readonly recentUsers = computed(() =>
    [...this.users()]
      .sort((a, b) => this.toTime(b.createdAt) - this.toTime(a.createdAt))
      .slice(0, 5),
  );

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      users: this.adminService.getUsers(),
      properties: this.adminService.getProperties(),
    }).subscribe({
      next: ({ users, properties }) => {
        this.users.set(users);
        this.properties.set(properties);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load admin dashboard right now.');
        this.loading.set(false);
      },
    });
  }

  getStatusClass(status: PropertyStatus): string {
    return `status-${status}`;
  }

  getListingImage(property: Property): string {
    return (
      property.images?.[0] ||
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900'
    );
  }

  formatDate(date: string): string {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Date pending';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }

  private toTime(date: string): number {
    const parsed = new Date(date).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}
