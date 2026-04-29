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

  private readonly DEFAULT_CENTER: L.LatLngTuple = [27.7172, 85.324];
  private readonly DEFAULT_ZOOM = 12;
  private readonly CARTO_DB_TILE_URL =
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  ngAfterViewInit(): void {
    this.initTimeout = setTimeout(() => {
      this.initMap();
      this.isInitialized = true;
      this.addMarkers();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isInitialized) return;

    if (changes['properties']) {
      this.clearMarkers();
      this.addMarkers();
    }

    if (changes['selectedPropertyId']) {
      this.highlightSelectedMarker();
    }
  }

  ngOnDestroy(): void {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }

    if (this.invalidateTimeout) {
      clearTimeout(this.invalidateTimeout);
    }

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

    L.tileLayer(this.CARTO_DB_TILE_URL, {
      attribution: '© CartoDB | © OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);

    this.invalidateTimeout = setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
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
      if (this.map) {
        this.map.invalidateSize();
      }
    });
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private addMarkers(): void {
    if (!this.properties?.length) return;

    this.properties.forEach((property) => {
      if (property.location?.lat == null || property.location?.lng == null) {
        return;
      }

      const isSelected = property.id === this.selectedPropertyId;
      const icon = this.createCustomIcon(isSelected);
      const marker = L.marker([property.location.lat, property.location.lng], {
        icon,
      });

      marker.on('click', () => {
        this.markerClick.emit(property.id);
        this.flyToProperty(property);
      });

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
    if (this.mode === 'search' && this.clusterGroup) {
      this.clusterGroup.clearLayers();
    } else if (this.markersLayer) {
      this.markersLayer.clearLayers();
    }
    this.markerMap.clear();
  }

  private highlightSelectedMarker(): void {
    this.markerMap.forEach((marker, id) => {
      const isSelected = id === this.selectedPropertyId;
      marker.setIcon(this.createCustomIcon(isSelected));
    });

    if (
      this.selectedPropertyId !== undefined &&
      this.markerMap.has(this.selectedPropertyId)
    ) {
      const marker = this.markerMap.get(this.selectedPropertyId);
      const latLng = marker?.getLatLng();
      if (latLng) {
        this.map.flyTo(latLng, 15, { animate: true });
      }
    }
  }

  private createCustomIcon(isSelected: boolean): L.DivIcon {
    return L.divIcon({
      className: 'custom-map-pin',
      html: `<div class="pin ${isSelected ? 'selected' : ''}"></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -36],
    });
  }

  private createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div class="cluster-icon">${count}</div>`,
      className: 'custom-cluster',
      iconSize: L.point(40, 40),
    });
  }

  private flyToProperty(property: Property): void {
    this.map.flyTo([property.location.lat, property.location.lng], 15, {
      animate: true,
    });
  }

  invalidateMapSize(): void {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}
