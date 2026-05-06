import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewComponent } from '../../../shared/components/map-view/map-view.component';
import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { PropertyService } from '../../../core/services/property.service';
import { ActivatedRoute } from '@angular/router';
import { Property } from '../../../core/models/property.model';
import * as L from 'leaflet';

@Component({
  selector: 'app-buyer-map-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapViewComponent,
    PropertyCardComponent,
    FooterComponent,
  ],
  templateUrl: './buyer-map-search.component.html',
  styleUrl: './buyer-map-search.component.scss',
})
export class BuyerMapSearchComponent implements OnInit, OnDestroy {
  private propertyService = inject(PropertyService);
  private route = inject(ActivatedRoute);

  @ViewChild(MapViewComponent) mapView?: MapViewComponent;

  allProperties: Property[] = [];
  filteredProperties: Property[] = [];
  selectedPropertyId?: number;
  isLoading = true;
  private initialLoadDone = false;
  private mapInvalidationFrame?: number;
  private mapInvalidationTimeout?: ReturnType<typeof setTimeout>;

  searchTerm = '';
  selectedType: '' | 'house' | 'apartment' | 'land' | 'commercial' = '';
  selectedListingType: '' | 'sale' | 'rent' = '';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  currentBounds?: L.LatLngBounds;
  priceDropdownOpen = false;
  tempMinPrice?: number;
  tempMaxPrice?: number;

  readonly priceBucketCount = 24;
  private readonly fallbackMaxPrice = 50000000;

  currentPage = 1;
  pageSize = 10;

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
    this.route.queryParams.subscribe((params) => {
      const previousListingType = this.selectedListingType;
      const requestedPropertyId = Number(params['propertyId']);
      const hasRequestedProperty = Number.isFinite(requestedPropertyId);

      this.viewMode = params['view'] === 'map' ? 'map' : 'list';

      if (params['type'] === 'sale') {
        this.selectedListingType = 'sale';
      } else if (params['type'] === 'rent') {
        this.selectedListingType = 'rent';
      } else {
        this.selectedListingType = '';
      }

      if (previousListingType !== this.selectedListingType) {
        this.resetPriceRange();
      }

      this.isLoading = true;
      this.initialLoadDone = false;

      this.propertyService.getApprovedProperties().subscribe({
        next: (properties) => {
          this.allProperties = properties;
          this.selectedPropertyId = hasRequestedProperty
            ? requestedPropertyId
            : undefined;
          this.applyFilters();
          if (this.selectedPropertyId !== undefined) {
            this.showPropertyPage(this.selectedPropertyId);
            this.scrollToProperty(this.selectedPropertyId);
          }
          this.isLoading = false;
          this.initialLoadDone = true;
        },
        error: () => {
          this.isLoading = false;
          this.initialLoadDone = true;
        },
      });
    });
  }

  ngOnDestroy(): void {
    if (this.mapInvalidationFrame) {
      cancelAnimationFrame(this.mapInvalidationFrame);
    }
    clearTimeout(this.mapInvalidationTimeout);
  }

  onMarkerClick(propertyId: number): void {
    this.selectedPropertyId = propertyId;
    this.showPropertyPage(propertyId);
    this.scrollToProperty(propertyId);
  }

  private showPropertyPage(propertyId: number): void {
    const index = this.filteredProperties.findIndex((p) => p.id === propertyId);
    if (index >= 0) {
      this.currentPage = Math.floor(index / this.pageSize) + 1;
    }
  }

  private scrollToProperty(propertyId: number): void {
    setTimeout(() => {
      const el = document.getElementById(`property-${propertyId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  onBoundsChanged(bounds: L.LatLngBounds): void {
    if (!bounds || !this.initialLoadDone) return;
    this.currentBounds = bounds;
    this.applyFilters();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedListingType = '';
    this.resetPriceRange();
    this.bedrooms = undefined;
    this.currentBounds = undefined;
    this.priceDropdownOpen = false;
    this.currentPage = 1;
    this.selectedPropertyId = undefined;
    this.filteredProperties = [...this.allProperties];
  }

  private _viewMode: 'map' | 'list' = 'list';

  get viewMode(): 'map' | 'list' {
    return this._viewMode;
  }

  set viewMode(mode: 'map' | 'list') {
    this._viewMode = mode;

    if (mode === 'map') {
      this.invalidateVisibleMap();
    }
  }

  setViewMode(mode: 'map' | 'list'): void {
    this.viewMode = mode;
  }

  private invalidateVisibleMap(): void {
    if (this.mapInvalidationFrame) {
      cancelAnimationFrame(this.mapInvalidationFrame);
    }
    clearTimeout(this.mapInvalidationTimeout);

    this.mapInvalidationFrame = requestAnimationFrame(() => {
      this.mapView?.invalidateMapSize();
      this.mapInvalidationTimeout = setTimeout(() => {
        this.mapView?.invalidateMapSize();
      }, 150);
    });
  }

  get paginatedProperties(): Property[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProperties.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredProperties.length / this.pageSize) || 1;
  }

  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.selectedPropertyId = undefined;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.selectedPropertyId = undefined;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.selectedPropertyId = undefined;
    }
  }

  selectProperty(propertyId: number): void {
    this.selectedPropertyId = propertyId;
  }

  get availableMinPrice(): number {
    const properties = this.priceScopeProperties;
    if (properties.length === 0) return 0;

    const min = Math.min(...properties.map((property) => property.price));
    return Math.floor(min / this.priceStep) * this.priceStep;
  }

  get priceStep(): number {
    const prices = this.priceScopeProperties.map((property) => property.price);
    const maxPrice = prices.length ? Math.max(...prices) : this.fallbackMaxPrice;

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

  get tempPriceSliderMin(): number {
    return this.tempMinPrice ?? this.availableMinPrice;
  }

  get tempPriceSliderMax(): number {
    return this.tempMaxPrice ?? this.availableMaxPrice;
  }

  get tempPriceStartPercent(): number {
    return this.getPricePercent(this.tempPriceSliderMin);
  }

  get tempPriceEndPercent(): number {
    return this.getPricePercent(this.tempPriceSliderMax);
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

      return {
        active: bucketMax >= activeMin && bucketMin <= activeMax,
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

  onListingTypeChange(): void {
    this.resetPriceRange();
    this.onFilterChange();
  }

  togglePriceDropdown(): void {
    if (!this.priceDropdownOpen) {
      this.syncTempPriceRange();
    }

    this.priceDropdownOpen = !this.priceDropdownOpen;
  }

  onTempMinPriceInput(event: Event): void {
    const value = this.getSliderInputValue(event);
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

  onTempMaxPriceInput(event: Event): void {
    const value = this.getSliderInputValue(event);
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

  closePriceDropdown(): void {
    this.priceDropdownOpen = false;
  }

  clearPriceFilter(): void {
    this.resetPriceRange();
    this.priceDropdownOpen = false;
    this.onFilterChange();
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

    if (this.currentBounds && this.initialLoadDone) {
      filtered = filtered.filter((p) => {
        if (p.location?.lat == null || p.location?.lng == null) return false;
        return this.currentBounds!.contains([p.location.lat, p.location.lng]);
      });
    }

    this.filteredProperties = filtered;

    if (
      this.selectedPropertyId !== undefined &&
      filtered.some((p) => p.id === this.selectedPropertyId)
    ) {
      this.showPropertyPage(this.selectedPropertyId);
    } else {
      this.selectedPropertyId = undefined;
      this.currentPage = 1;
    }
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
}
