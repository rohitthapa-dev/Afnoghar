import {
  Component,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { Property } from '../../../core/models/property.model';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  @Input() properties: Property[] = [];
  @Input() selectedPropertyId?: number;
  @Input() mode: 'search' | 'detail' = 'search';

  @Output() markerClick = new EventEmitter<number>();
  @Output() boundsChanged = new EventEmitter<L.LatLngBounds>();

  private map!: L.Map;
  private markersLayer!: L.LayerGroup;
  private clusterGroup!: L.MarkerClusterGroup;
  private markerMap = new Map<number, L.Marker>();
  private isInitialized = false;
  private initTimeout?: ReturnType<typeof setTimeout>;
  private invalidateTimeout?: ReturnType<typeof setTimeout>;
  private resizeObserver?: ResizeObserver;
  private previewCloseTimeout?: ReturnType<typeof setTimeout>;

  private readonly FALLBACK_IMAGE =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600';

  private get css() {
    const s = getComputedStyle(document.documentElement);
    return {
      primary: s.getPropertyValue('--color-primary').trim(),
      primaryDark: s.getPropertyValue('--color-primary-dark').trim(),
      accent: s.getPropertyValue('--color-accent').trim(),
      accentDark: s.getPropertyValue('--color-accent-dark').trim(),
      info: s.getPropertyValue('--color-info').trim(),
      infoDark: s.getPropertyValue('--color-info-dark').trim(),
      surface: s.getPropertyValue('--color-surface').trim(),
      pulsePrimary: s.getPropertyValue('--pulse-primary').trim(),
      pulseAccent: s.getPropertyValue('--pulse-accent').trim(),
      pulseInfo: s.getPropertyValue('--pulse-info').trim(),
    };
  }

  private readonly DEFAULT_CENTER: L.LatLngTuple = [27.7172, 85.324];
  private readonly DEFAULT_ZOOM = 12;
  private readonly TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  ngAfterViewInit(): void {
    this.initTimeout = setTimeout(() => {
      this.initMap();
      this.isInitialized = true;
      this.addMarkers();
      if (this.mode === 'search' && this.selectedPropertyId) {
        this.highlightSelectedMarker(true);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isInitialized) return;
    if (changes['properties']) {
      this.clearMarkers();
      this.addMarkers();
      this.updateSelectedMarkerIcon();
    }
    if (changes['selectedPropertyId']) {
      this.highlightSelectedMarker(true);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.initTimeout);
    clearTimeout(this.invalidateTimeout);
    clearTimeout(this.previewCloseTimeout);
    this.resizeObserver?.disconnect();
    if (this.map) {
      this.map.remove();
      this.map = undefined!;
    }
    this.markerMap.clear();
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.DEFAULT_CENTER,
      zoom: this.DEFAULT_ZOOM,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer(this.TILE_URL, {
      attribution: '© CartoDB | © OpenStreetMap',
      maxZoom: 18,
      minZoom: 8,
    }).addTo(this.map);

    this.invalidateTimeout = setTimeout(() => {
      this.map?.invalidateSize();
    }, 100);

    if (this.mode === 'search') {
      this.clusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => this.createClusterIcon(cluster),
      });
      this.map.addLayer(this.clusterGroup);
    } else {
      this.markersLayer = L.layerGroup().addTo(this.map);
    }

    this.map.on('moveend', () => {
      const bounds = this.map.getBounds();
      if (bounds && this.mode === 'search') {
        this.boundsChanged.emit(bounds);
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private addMarkers(): void {
    if (!this.properties?.length) return;

    this.properties.forEach((property) => {
      if (property.location?.lat == null || property.location?.lng == null)
        return;

      const isSelected = property.id === this.selectedPropertyId;
      const marker = L.marker([property.location.lat, property.location.lng], {
        icon: this.createCustomIcon(isSelected, property.listingType),
      });

      this.bindPreviewPopup(marker, property);

      marker.on('click', () => {
        this.markerClick.emit(property.id);
        this.flyToProperty(property);
        this.openPreview(marker);
      });

      marker.on('mouseover', () => this.openPreview(marker));
      marker.on('mouseout', () => this.schedulePreviewClose());

      if (this.mode === 'search' && this.clusterGroup) {
        this.clusterGroup.addLayer(marker);
      } else if (this.markersLayer) {
        this.markersLayer.addLayer(marker);
      }

      this.markerMap.set(property.id, marker);
    });

    if (this.mode === 'detail' && this.properties.length === 1) {
      const prop = this.properties[0];
      this.map.flyTo([prop.location.lat, prop.location.lng], 15, {
        animate: true,
      });
    }
  }

  private clearMarkers(): void {
    clearTimeout(this.previewCloseTimeout);
    if (this.mode === 'search' && this.clusterGroup) {
      this.clusterGroup.clearLayers();
    } else if (this.markersLayer) {
      this.markersLayer.clearLayers();
    }
    this.markerMap.clear();
  }

  private updateSelectedMarkerIcon(): void {
    this.markerMap.forEach((marker, id) => {
      const prop = this.properties.find((p) => p.id === id);
      marker.setIcon(
        this.createCustomIcon(
          id === this.selectedPropertyId,
          prop?.listingType,
        ),
      );
    });
  }

  private highlightSelectedMarker(shouldFlyToMarker = false): void {
    this.updateSelectedMarkerIcon();

    if (
      shouldFlyToMarker &&
      this.selectedPropertyId &&
      this.markerMap.has(this.selectedPropertyId)
    ) {
      const latLng = this.markerMap.get(this.selectedPropertyId)?.getLatLng();
      if (latLng) this.map.flyTo(latLng, 15, { animate: true });
    }
  }

  private createCustomIcon(
    isSelected: boolean,
    listingType?: string,
  ): L.DivIcon {
    const c = this.css;
    const isRent = listingType === 'rent';
    const color = isRent
      ? isSelected
        ? c.accentDark
        : c.accent
      : isSelected
        ? c.primaryDark
        : c.primary;
    const pulseColor = isRent ? c.pulseAccent : c.pulsePrimary;

    return L.divIcon({
      className: 'custom-map-pin',
      html: `<div
        class="pin ${isSelected ? 'selected' : ''}"
        style="background:${color};--pulse-color:${pulseColor};"
      ></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -36],
    });
  }

  private createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
    const c = this.css;
    const markers = cluster.getAllChildMarkers();
    const rentCount = markers.filter((m) => {
      const ll = m.getLatLng();
      return (
        this.properties.find(
          (p) => p.location.lat === ll.lat && p.location.lng === ll.lng,
        )?.listingType === 'rent'
      );
    }).length;

    const color = rentCount > markers.length / 2 ? c.accent : c.primary;
    const count = cluster.getChildCount();

    return L.divIcon({
      html: `<div class="cluster-icon" style="background:${color}">${count}</div>`,
      className: 'custom-cluster',
      iconSize: L.point(40, 40),
    });
  }

  private flyToProperty(property: Property): void {
    this.map.flyTo([property.location.lat, property.location.lng], 15, {
      animate: true,
    });
  }

  private bindPreviewPopup(marker: L.Marker, property: Property): void {
    marker.bindPopup(this.createPreviewPopupContent(property), {
      closeButton: false,
      className: 'property-preview-popup',
      offset: L.point(0, -10),
      autoPanPadding: L.point(24, 24),
    });

    marker.on('popupopen', (event) => {
      this.setupPreviewPopup(event.popup, property);
    });
  }

  private openPreview(marker: L.Marker): void {
    clearTimeout(this.previewCloseTimeout);
    marker.openPopup();
  }

  private schedulePreviewClose(): void {
    clearTimeout(this.previewCloseTimeout);
    this.previewCloseTimeout = setTimeout(() => {
      this.map?.closePopup();
    }, 180);
  }

  private setupPreviewPopup(popup: L.Popup, property: Property): void {
    const element = popup.getElement();
    if (!element) return;

    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);

    if (element.dataset['previewReady'] === String(property.id)) return;
    element.dataset['previewReady'] = String(property.id);

    element.addEventListener('mouseenter', () => {
      clearTimeout(this.previewCloseTimeout);
    });
    element.addEventListener('mouseleave', () => {
      this.schedulePreviewClose();
    });

    const images = this.getPreviewImages(property);
    if (images.length <= 1) return;

    let currentIndex = 0;
    const image = element.querySelector<HTMLImageElement>(
      '.preview-carousel-image',
    );
    const counter = element.querySelector<HTMLElement>('.preview-image-count');
    const dots = Array.from(
      element.querySelectorAll<HTMLElement>('.preview-dot'),
    );

    const renderImage = () => {
      if (!image) return;
      image.src = images[currentIndex];
      image.alt = `${property.title} photo ${currentIndex + 1}`;
      if (counter) {
        counter.textContent = `${currentIndex + 1}/${images.length}`;
      }
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex);
      });
    };

    image?.addEventListener('error', () => {
      image.src = this.FALLBACK_IMAGE;
    });

    element
      .querySelectorAll<HTMLElement>('[data-preview-step]')
      .forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const step = Number(button.dataset['previewStep']);
          currentIndex = (currentIndex + step + images.length) % images.length;
          renderImage();
        });
      });

    dots.forEach((dot, index) => {
      dot.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        currentIndex = index;
        renderImage();
      });
    });
  }

  private createPreviewPopupContent(property: Property): string {
    const images = this.getPreviewImages(property);
    const firstImage = this.escapeAttr(images[0]);
    const title = this.escapeHtml(property.title);
    const price = this.escapeHtml(
      this.formatPreviewPrice(property.price, property.listingType),
    );
    const location = this.escapeHtml(
      [property.location?.city, property.location?.district]
        .filter(Boolean)
        .join(', '),
    );
    const imageControls =
      images.length > 1
        ? `<button type="button" class="preview-nav preview-prev" data-preview-step="-1" aria-label="Previous photo">
            <i class="bi bi-chevron-left" aria-hidden="true"></i>
          </button>
          <button type="button" class="preview-nav preview-next" data-preview-step="1" aria-label="Next photo">
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
          <span class="preview-image-count">1/${images.length}</span>
          <div class="preview-dots" aria-hidden="true">
            ${images
              .map(
                (_, index) =>
                  `<button type="button" class="preview-dot ${index === 0 ? 'active' : ''}" aria-label="Show photo ${index + 1}"></button>`,
              )
              .join('')}
          </div>`
        : '';

    return `<article class="map-property-preview">
      <div class="preview-carousel">
        <img class="preview-carousel-image" src="${firstImage}" alt="${title} photo 1" loading="lazy" />
        ${imageControls}
      </div>
      <div class="preview-body">
        <div class="preview-meta">
          <span>${this.escapeHtml(property.type)}</span>
          <span>${this.escapeHtml(property.listingType)}</span>
        </div>
        <h3>${title}</h3>
        <p>${location}</p>
        <strong>${price}</strong>
      </div>
    </article>`;
  }

  private getPreviewImages(property: Property): string[] {
    const images = (property.images || [])
      .map((image) => image.trim())
      .filter(Boolean);
    return images.length ? images : [this.FALLBACK_IMAGE];
  }

  private formatPreviewPrice(
    value: number,
    listingType: Property['listingType'],
  ): string {
    if (!value) return 'Price on request';

    if (listingType === 'rent') {
      return `Rs. ${value.toLocaleString('en-NP')}/month`;
    }

    if (value >= 10000000) {
      return `Rs. ${this.formatCompactAmount(value / 10000000)} Cr`;
    }

    if (value >= 100000) {
      return `Rs. ${this.formatCompactAmount(value / 100000)} Lakh`;
    }

    return `Rs. ${value.toLocaleString('en-NP')}`;
  }

  private formatCompactAmount(value: number): string {
    return value.toLocaleString('en-NP', {
      maximumFractionDigits: value >= 10 ? 1 : 2,
      minimumFractionDigits: 0,
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value);
  }

  invalidateMapSize(): void {
    this.map?.invalidateSize();
  }
}
