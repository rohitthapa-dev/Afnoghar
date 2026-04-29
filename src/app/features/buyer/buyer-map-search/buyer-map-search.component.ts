import { Component, OnInit, ViewChild, inject } from '@angular/core';
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
export class BuyerMapSearchComponent implements OnInit {
  private propertyService = inject(PropertyService);
  private route = inject(ActivatedRoute);

  @ViewChild(MapViewComponent) mapView?: MapViewComponent;

  allProperties: Property[] = [];
  filteredProperties: Property[] = [];
  selectedPropertyId?: number;
  isLoading = true;
  private initialLoadDone = false;

  searchTerm = '';
  selectedType: '' | 'house' | 'apartment' | 'land' | 'commercial' = '';
  selectedListingType: '' | 'sale' | 'rent' = '';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  currentBounds?: L.LatLngBounds;

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
      if (params['type'] === 'sale') {
        this.selectedListingType = 'sale';
      } else if (params['type'] === 'rent') {
        this.selectedListingType = 'rent';
      }

      this.isLoading = true;
      this.initialLoadDone = false;

      this.propertyService.getApprovedProperties().subscribe({
        next: (properties) => {
          this.allProperties = properties;
          this.applyFilters();
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
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.bedrooms = undefined;
    this.currentBounds = undefined;
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
    setTimeout(() => {
      if (mode === 'map' && this.mapView) {
        this.mapView.invalidateMapSize();
      }
    }, 200);
  }

  setViewMode(mode: 'map' | 'list'): void {
    this.viewMode = mode;
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
}
