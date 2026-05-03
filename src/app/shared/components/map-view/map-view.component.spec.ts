import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { Property } from '../../../core/models/property.model';

describe('MapViewComponent', () => {
  let component: MapViewComponent;
  let fixture: ComponentFixture<MapViewComponent>;

  const mockProperties: Property[] = [
    {
      id: 1,
      title: 'Test Property 1',
      description: 'Test',
      type: 'house',
      listingType: 'sale',
      price: 10000000,
      area: 1000,
      aana: 10,
      bedrooms: 3,
      bathrooms: 2,
      floors: 1,
      location: {
        district: 'Kathmandu',
        city: 'Kathmandu',
        address: 'Test Address 1',
        lat: 27.7172,
        lng: 85.324,
      },
      images: [],
      features: [],
      sellerId: 2,
      status: 'approved',
      isFeatured: false,
      createdAt: '2025-01-01',
    },
    {
      id: 2,
      title: 'Test Property 2',
      description: 'Test',
      type: 'apartment',
      listingType: 'rent',
      price: 50000,
      area: 800,
      aana: 8,
      bedrooms: 2,
      bathrooms: 1,
      floors: 1,
      location: {
        district: 'Lalitpur',
        city: 'Lalitpur',
        address: 'Test Address 2',
        lat: 27.6588,
        lng: 85.3247,
      },
      images: [],
      features: [],
      sellerId: 4,
      status: 'approved',
      isFeatured: true,
      createdAt: '2025-01-02',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MapViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.properties).toEqual([]);
    expect(component.selectedPropertyId).toBeUndefined();
    expect(component.mode).toBe('search');
  });

  it('should emit markerClick when a marker is clicked', (done) => {
    component.properties = mockProperties;
    component.ngAfterViewInit();

    component.markerClick.subscribe((propertyId: number) => {
      expect(propertyId).toBe(1);
      done();
    });

    setTimeout(() => {
      const marker = component['markerMap'].get(1);
      if (marker) {
        marker.fire('click');
      }
    }, 100);
  });

  it('should update selected marker when selectedPropertyId changes', () => {
    component.properties = mockProperties;
    component.ngAfterViewInit();

    component.selectedPropertyId = 1;
    component.ngOnChanges({
      selectedPropertyId: {
        currentValue: 1,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      } as any,
    });

    const marker = component['markerMap'].get(1);
    expect(marker).toBeDefined();
  });

  it('should clear markers when properties input changes', () => {
    component.properties = mockProperties;
    component.ngAfterViewInit();

    const clearSpy = spyOn(component as any, 'clearMarkers');
    component.properties = [mockProperties[0]];
    component.ngOnChanges({
      properties: {
        currentValue: [mockProperties[0]],
        previousValue: mockProperties,
        firstChange: false,
        isFirstChange: () => false,
      } as any,
    });

    expect(clearSpy).toHaveBeenCalled();
  });
});
