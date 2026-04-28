import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PropertyService } from '../../../core/services/property.service';
import { Property } from '../../../core/models/property.model';
import { PropertyCardComponent } from '../../../shared/components/property-card/property-card.component';

@Component({
  selector: 'app-buyer-property-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-property-list.component.html',
  styleUrl: './buyer-property-list.component.scss',
})
export class BuyerPropertyListComponent implements OnInit {
  private propertyService = inject(PropertyService);

  properties: Property[] = [];
  filteredProperties: Property[] = [];
  loading = true;
  error = '';

  pageSize = 6;
  pageIndex = 0;

  ngOnInit(): void {
    this.loadProperties();
  }

  loadProperties(): void {
    this.loading = true;
    this.error = '';

    this.propertyService.getApprovedProperties().subscribe({
      next: (properties) => {
        this.properties = properties;
        this.filteredProperties = properties;
        this.loading = false;
      },
      error: (err) => {
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
}
