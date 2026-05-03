import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Property,
  PropertyStatus,
} from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyService } from '../../../core/services/property.service';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

type ListingFilter = 'all' | PropertyStatus;

interface ListingTab {
  label: string;
  value: ListingFilter;
  icon: string;
}

@Component({
  selector: 'app-seller-my-listings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PriceFormatPipe,
    PropertyTypePipe,
  ],
  templateUrl: './seller-my-listings.component.html',
  styleUrl: './seller-my-listings.component.scss',
})
export class SellerMyListingsComponent implements OnInit {
  private propertyService = inject(PropertyService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly tabs: ListingTab[] = [
    { label: 'All', value: 'all', icon: 'grid_view' },
    { label: 'Approved', value: 'approved', icon: 'verified' },
    { label: 'Pending', value: 'pending', icon: 'schedule' },
    { label: 'Rejected', value: 'rejected', icon: 'error_outline' },
  ];

  readonly fallbackImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900';

  readonly listings = signal<Property[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedFilter = signal<ListingFilter>('all');
  readonly searchTerm = signal('');

  readonly filteredListings = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.selectedFilter();

    return this.listings().filter((listing) => {
      const matchesStatus = filter === 'all' || listing.status === filter;
      const matchesSearch =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.location.city.toLowerCase().includes(term) ||
        listing.location.district.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  });

  readonly approvedCount = computed(() => this.getStatusCount('approved'));
  readonly pendingCount = computed(() => this.getStatusCount('pending'));
  readonly rejectedCount = computed(() => this.getStatusCount('rejected'));

  readonly totalPortfolioValue = computed(() =>
    this.listings().reduce((sum, listing) => sum + listing.price, 0),
  );

  ngOnInit(): void {
    this.loadListings();
  }

  loadListings(): void {
    const sellerId = this.authService.getCurrentUser()?.id;

    if (!sellerId) {
      this.error.set('Please login to manage your listings.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.propertyService.getProperties().subscribe({
      next: (properties) => {
        this.listings.set(
          properties
            .filter((property) => property.sellerId === sellerId)
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime(),
            ),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load listings right now.');
        this.loading.set(false);
      },
    });
  }

  selectFilter(filter: ListingFilter): void {
    this.selectedFilter.set(filter);
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  getTabCount(filter: ListingFilter): number {
    if (filter === 'all') return this.listings().length;
    return this.getStatusCount(filter);
  }

  getStatusClass(status: PropertyStatus): string {
    return `status-${status}`;
  }

  getStatusLabel(status: PropertyStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getImage(listing: Property): string {
    return listing.images?.[0] || this.fallbackImage;
  }

  getLocation(listing: Property): string {
    return `${listing.location.city}, ${listing.location.district}`;
  }

  editListing(listing: Property): void {
    this.router.navigate(['/seller/properties', listing.id, 'edit']);
  }

  viewListing(listing: Property): void {
    this.router.navigate(['/buyer/properties', listing.id]);
  }

  deleteListing(listing: Property): void {
    const confirmed = window.confirm(
      `Delete "${listing.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.propertyService.deleteProperty(listing.id).subscribe({
      next: () => {
        this.listings.update((items) =>
          items.filter((item) => item.id !== listing.id),
        );
        this.snackBar.open('Listing deleted', 'Close', {
          duration: 3000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.snackBar.open('Failed to delete listing', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  private getStatusCount(status: PropertyStatus): number {
    return this.listings().filter((listing) => listing.status === status)
      .length;
  }
}
