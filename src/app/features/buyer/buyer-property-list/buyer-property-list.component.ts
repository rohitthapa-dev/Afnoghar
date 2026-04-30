import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { PropertyService } from '../../../core/services/property.service';
import { Property, PropertyFilter, PropertyType, ListingType } from '../../../core/models/property.model';
import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';
import { PropertyTypePipe } from '../../../shared/pipes/property-type.pipe';

@Component({
  selector: 'app-buyer-property-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatChipsModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-property-list.component.html',
  styleUrl: './buyer-property-list.component.scss',
})
export class BuyerPropertyListComponent implements OnInit {
  private propertyService = inject(PropertyService);

  allProperties: Property[] = [];
  filteredProperties: Property[] = [];
  loading = true;
  error = '';

  pageSize = 6;
  pageIndex = 0;

  // Filter state
  searchTerm = '';
  selectedType: '' | PropertyType = '';
  selectedListingType: '' | ListingType = '';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;

  get hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.selectedType ||
      this.selectedListingType ||
      this.minPrice != null ||
      this.maxPrice != null ||
      this.bedrooms != null
    );
  }

  ngOnInit(): void {
    this.loadProperties();
  }

  loadProperties(): void {
    this.loading = true;
    this.error = '';

    this.propertyService.getApprovedProperties().subscribe({
      next: (properties) => {
        this.allProperties = properties;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load properties. Please try again.';
        this.loading = false;
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  get paginatedProperties(): Property[] {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredProperties.slice(start, end);
  }

  get totalProperties(): number {
    return this.filteredProperties.length;
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedListingType = '';
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.bedrooms = undefined;
    this.pageIndex = 0;
    this.filteredProperties = [...this.allProperties];
  }

  private applyFilters(): void {
    let filtered = [...this.allProperties];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.location?.city?.toLowerCase().includes(term) ||
          p.location?.district?.toLowerCase().includes(term)
      );
    }

    if (this.selectedType) {
      filtered = filtered.filter((p) => p.type === this.selectedType);
    }

    if (this.selectedListingType) {
      filtered = filtered.filter(
        (p) => p.listingType === this.selectedListingType
      );
    }

    if (this.minPrice != null) {
      filtered = filtered.filter((p) => p.price >= this.minPrice!);
    }

    if (this.maxPrice != null) {
      filtered = filtered.filter((p) => p.price <= this.maxPrice!);
    }

    if (this.bedrooms != null) {
      filtered = filtered.filter((p) => p.bedrooms >= this.bedrooms!);
    }

    this.filteredProperties = filtered;
  }
}
