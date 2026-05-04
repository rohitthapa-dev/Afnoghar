import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Property,
  PropertyStatus,
} from '../../../core/models/property.model';
import { AdminService } from '../../../core/services/admin.service';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

type ListingFilter = 'all' | PropertyStatus | 'featured';

interface ListingTab {
  label: string;
  value: ListingFilter;
  icon: string;
}

@Component({
  selector: 'app-admin-manage-listings',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    PriceFormatPipe,
    PropertyTypePipe,
  ],
  templateUrl: './admin-manage-listings.component.html',
  styleUrl: './admin-manage-listings.component.scss',
})
export class AdminManageListingsComponent implements OnInit {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly tabs: ListingTab[] = [
    { label: 'All', value: 'all', icon: 'grid_view' },
    { label: 'Pending', value: 'pending', icon: 'schedule' },
    { label: 'Approved', value: 'approved', icon: 'verified' },
    { label: 'Rejected', value: 'rejected', icon: 'block' },
    { label: 'Featured', value: 'featured', icon: 'workspace_premium' },
  ];

  readonly fallbackImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900';

  readonly listings = signal<Property[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedFilter = signal<ListingFilter>('all');
  readonly searchTerm = signal('');
  readonly updatingIds = signal<Set<number>>(new Set());

  readonly filteredListings = computed(() => {
    const filter = this.selectedFilter();
    const term = this.searchTerm().trim().toLowerCase();

    return this.listings().filter((listing) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'featured' ? listing.isFeatured : listing.status === filter);
      const matchesSearch =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.location.city.toLowerCase().includes(term) ||
        listing.location.district.toLowerCase().includes(term) ||
        listing.type.toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  });

  readonly pendingCount = computed(() => this.getStatusCount('pending'));
  readonly approvedCount = computed(() => this.getStatusCount('approved'));
  readonly rejectedCount = computed(() => this.getStatusCount('rejected'));
  readonly featuredCount = computed(
    () => this.listings().filter((listing) => listing.isFeatured).length,
  );

  ngOnInit(): void {
    this.loadListings();
  }

  loadListings(): void {
    this.loading.set(true);
    this.error.set('');

    this.adminService.getProperties().subscribe({
      next: (listings) => {
        this.listings.set(
          listings.sort(
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
    if (filter === 'featured') return this.featuredCount();
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

  getSizeLabel(listing: Property): string {
    if (listing.type === 'land' && listing.aana) {
      return `${listing.aana} aana`;
    }

    if (listing.area) {
      return `${listing.area} sq.ft`;
    }

    return 'Size pending';
  }

  isUpdating(listing: Property): boolean {
    return this.updatingIds().has(listing.id);
  }

  approveListing(listing: Property): void {
    this.patchListing(listing, { status: 'approved' }, 'Listing approved');
  }

  rejectListing(listing: Property): void {
    this.patchListing(listing, { status: 'rejected' }, 'Listing rejected');
  }

  toggleFeatured(listing: Property): void {
    this.patchListing(
      listing,
      { isFeatured: !listing.isFeatured },
      listing.isFeatured ? 'Listing removed from featured' : 'Listing featured',
    );
  }

  viewListing(listing: Property): void {
    this.router.navigate(['/buyer/properties', listing.id]);
  }

  deleteListing(listing: Property): void {
    const confirmed = window.confirm(
      `Delete "${listing.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    this.setUpdating(listing.id, true);

    this.adminService.deleteProperty(listing.id).subscribe({
      next: () => {
        this.listings.update((items) =>
          items.filter((item) => item.id !== listing.id),
        );
        this.setUpdating(listing.id, false);
        this.showMessage('Listing deleted');
      },
      error: () => {
        this.setUpdating(listing.id, false);
        this.showMessage('Unable to delete listing.');
      },
    });
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

  private patchListing(
    listing: Property,
    payload: Partial<Property>,
    successMessage: string,
  ): void {
    this.setUpdating(listing.id, true);

    this.adminService.updateProperty(listing.id, payload).subscribe({
      next: (updatedListing) => {
        this.listings.update((items) =>
          items.map((item) =>
            item.id === updatedListing.id ? updatedListing : item,
          ),
        );
        this.setUpdating(listing.id, false);
        this.showMessage(successMessage);
      },
      error: () => {
        this.setUpdating(listing.id, false);
        this.showMessage('Unable to update listing.');
      },
    });
  }

  private setUpdating(id: number, updating: boolean): void {
    this.updatingIds.update((current) => {
      const next = new Set(current);
      if (updating) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private getStatusCount(status: PropertyStatus): number {
    return this.listings().filter((listing) => listing.status === status)
      .length;
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2800,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
    });
  }
}
