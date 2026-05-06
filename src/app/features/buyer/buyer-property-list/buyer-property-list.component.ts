import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PropertyService } from '../../../core/services/property.service';

import {
  Property,
  PropertyType,
  ListingType,
} from '../../../core/models/property.model';

import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';

@Component({
  selector: 'app-buyer-property-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatChipsModule,
    MatSliderModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-property-list.component.html',
  styleUrl: './buyer-property-list.component.scss',
})
export class BuyerPropertyListComponent implements OnInit {
  private propertyService = inject(PropertyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  allProperties: Property[] = [];
  filteredProperties: Property[] = [];
  loading = true;
  error = '';

  pageSize = 6;
  pageIndex = 0;

  searchTerm = '';
  selectedType: '' | PropertyType = '';
  selectedListingType: '' | ListingType = '';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;

  priceDropdownOpen = false;
  tempMinPrice?: number;
  tempMaxPrice?: number;

  readonly priceBucketCount = 24;
  private readonly fallbackMaxPrice = 50000000;

  readonly formatSliderLabel = (value: number): string =>
    this.formatPrice(value);

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
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const previousListingType = this.selectedListingType;
        const listingType = params.get('listingType');

        this.selectedListingType =
          listingType === ListingType.Sale || listingType === ListingType.Rent
            ? listingType
            : '';

        if (!this.loading && previousListingType !== this.selectedListingType) {
          this.resetPriceRange();
          this.onFilterChange();
        }
      });

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

  get paginatedProperties(): Property[] {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredProperties.slice(start, end);
  }

  get totalProperties(): number {
    return this.filteredProperties.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalProperties / this.pageSize) || 1;
  }

  get currentPage(): number {
    return this.pageIndex + 1;
  }

  get visiblePages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.pageIndex += 1;
  }

  previousPage(): void {
    if (this.pageIndex === 0) return;
    this.pageIndex -= 1;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageIndex = page - 1;
  }

  get availableMinPrice(): number {
    const properties = this.priceScopeProperties;
    if (properties.length === 0) return 0;

    const min = Math.min(...properties.map((property) => property.price));
    return Math.floor(min / this.priceStep) * this.priceStep;
  }

  get priceStep(): number {
    const prices = this.priceScopeProperties.map((property) => property.price);
    const maxPrice = prices.length
      ? Math.max(...prices)
      : this.fallbackMaxPrice;

    if (this.selectedListingType === 'rent' || maxPrice <= 500000) {
      return 1000;
    }

    if (maxPrice <= 2000000) {
      return 25000;
    }

    return 100000;
  }

  get availableMaxPrice(): number {
    const properties = this.priceScopeProperties;
    if (properties.length === 0) return this.fallbackMaxPrice;

    const max = Math.max(...properties.map((property) => property.price));

    return Math.max(
      this.availableMinPrice + this.priceStep,
      Math.ceil(max / this.priceStep) * this.priceStep,
    );
  }

  get priceSliderMin(): number {
    return this.minPrice ?? this.availableMinPrice;
  }

  get priceSliderMax(): number {
    return this.maxPrice ?? this.availableMaxPrice;
  }

  get tempPriceSliderMin(): number {
    return this.tempMinPrice ?? this.availableMinPrice;
  }

  get tempPriceSliderMax(): number {
    return this.tempMaxPrice ?? this.availableMaxPrice;
  }

  get priceRangeLabel(): string {
    if (this.priceDropdownOpen) {
      return this.getRangeLabel(this.tempMinPrice, this.tempMaxPrice);
    }

    return this.getRangeLabel(this.minPrice, this.maxPrice);
  }

  get tempPriceRangeLabel(): string {
    return this.getRangeLabel(this.tempMinPrice, this.tempMaxPrice);
  }

  get tempPriceStartPercent(): number {
    return this.getPricePercent(this.tempPriceSliderMin);
  }

  get tempPriceEndPercent(): number {
    return this.getPricePercent(this.tempPriceSliderMax);
  }

  get priceHistogram(): Array<{ height: number; active: boolean }> {
    const buckets = Array.from({ length: this.priceBucketCount }, () => 0);
    const min = this.availableMinPrice;
    const max = this.availableMaxPrice;
    const range = Math.max(max - min, this.priceStep);

    this.priceScopeProperties.forEach((property) => {
      const bucketIndex = Math.min(
        this.priceBucketCount - 1,
        Math.max(
          0,
          Math.floor(((property.price - min) / range) * this.priceBucketCount),
        ),
      );

      buckets[bucketIndex] += 1;
    });

    const highestCount = Math.max(...buckets, 1);
    const activeMin = this.tempPriceSliderMin;
    const activeMax = this.tempPriceSliderMax;

    return buckets.map((count, index) => {
      const bucketMin = min + (range / this.priceBucketCount) * index;
      const bucketMax = min + (range / this.priceBucketCount) * (index + 1);
      const active = bucketMax >= activeMin && bucketMin <= activeMax;

      return {
        active,
        height: count === 0 ? 8 : Math.max(14, (count / highestCount) * 100),
      };
    });
  }

  get priceScopeProperties(): Property[] {
    if (!this.selectedListingType) return this.allProperties;

    return this.allProperties.filter(
      (property) => property.listingType === this.selectedListingType,
    );
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  onMinPriceChange(value: number): void {
    this.minPrice = Math.min(value, this.priceSliderMax - this.priceStep);
    this.onFilterChange();
  }

  onMaxPriceChange(value: number): void {
    this.maxPrice = Math.max(value, this.priceSliderMin + this.priceStep);
    this.onFilterChange();
  }

  togglePriceDropdown(): void {
    if (!this.priceDropdownOpen) {
      this.syncTempPriceRange();
    }

    this.priceDropdownOpen = !this.priceDropdownOpen;
  }

  onTempMinPriceChange(value: number): void {
    const boundedValue = Math.min(
      value,
      this.tempPriceSliderMax - this.priceStep,
    );

    this.tempMinPrice =
      boundedValue <= this.availableMinPrice ? undefined : boundedValue;

    this.minPrice = this.tempMinPrice;
    this.maxPrice = this.tempMaxPrice;
    this.onFilterChange();
  }

  onTempMaxPriceChange(value: number): void {
    const boundedValue = Math.max(
      value,
      this.tempPriceSliderMin + this.priceStep,
    );

    this.tempMaxPrice =
      boundedValue >= this.availableMaxPrice ? undefined : boundedValue;

    this.minPrice = this.tempMinPrice;
    this.maxPrice = this.tempMaxPrice;
    this.onFilterChange();
  }

  onTempMinPriceInput(event: Event): void {
    this.onTempMinPriceChange(this.getSliderInputValue(event));
  }

  onTempMaxPriceInput(event: Event): void {
    this.onTempMaxPriceChange(this.getSliderInputValue(event));
  }

  applyPriceFilter(): void {
    this.minPrice = this.tempMinPrice;
    this.maxPrice = this.tempMaxPrice;
    this.priceDropdownOpen = false;
  }

  clearPriceFilter(): void {
    this.resetPriceRange();
    this.priceDropdownOpen = false;
    this.onFilterChange();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedListingType = '';
    this.resetPriceRange();
    this.bedrooms = undefined;
    this.priceDropdownOpen = false;
    this.pageIndex = 0;
    this.filteredProperties = [...this.allProperties];

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  formatPrice(value: number | undefined): string {
    const price = value ?? 0;
    const absPrice = Math.abs(price);

    if (absPrice >= 10000000) {
      return `Rs. ${this.formatNepaliAmount(price / 10000000)} Cr`;
    }

    if (absPrice >= 100000) {
      return `Rs. ${this.formatNepaliAmount(price / 100000)} Lakh`;
    }

    return `Rs. ${new Intl.NumberFormat('en-IN').format(price)}`;
  }

  private formatNepaliAmount(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: value >= 10 ? 1 : 2,
      minimumFractionDigits: 0,
    }).format(value);
  }

  private getRangeLabel(minPrice?: number, maxPrice?: number): string {
    if (minPrice == null && maxPrice == null) return 'Any price';

    if (minPrice != null && maxPrice != null) {
      return `${this.formatPrice(minPrice)} - ${this.formatPrice(maxPrice)}`;
    }

    if (minPrice != null) return `${this.formatPrice(minPrice)}+`;

    return `Up to ${this.formatPrice(maxPrice)}`;
  }

  private getSliderInputValue(event: Event): number {
    const input = event.target as HTMLInputElement;
    return Number(input.value);
  }

  private getPricePercent(value: number): number {
    const range = Math.max(
      this.availableMaxPrice - this.availableMinPrice,
      this.priceStep,
    );

    return ((value - this.availableMinPrice) / range) * 100;
  }

  private syncTempPriceRange(): void {
    this.tempMinPrice = this.minPrice;
    this.tempMaxPrice = this.maxPrice;
  }

  private resetPriceRange(): void {
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.tempMinPrice = undefined;
    this.tempMaxPrice = undefined;
  }

  private applyFilters(): void {
    let filtered = [...this.allProperties];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();

      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.location?.city?.toLowerCase().includes(term) ||
          p.location?.district?.toLowerCase().includes(term),
      );
    }

    if (this.selectedType) {
      filtered = filtered.filter((p) => p.type === this.selectedType);
    }

    if (this.selectedListingType) {
      filtered = filtered.filter(
        (p) => p.listingType === this.selectedListingType,
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
