import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import * as L from 'leaflet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  CreatePropertyPayload,
  ListingType,
  Property,
  PropertyType,
} from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyService } from '../../../core/services/property.service';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-seller-property-upload',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './seller-property-upload.component.html',
  styleUrl: './seller-property-upload.component.scss',
})
export class SellerPropertyUploadComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('locationMap') locationMapContainer?: ElementRef<HTMLDivElement>;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private propertyService = inject(PropertyService);
  private snackBar = inject(MatSnackBar);
  private locationMap?: L.Map;
  private locationMarker?: L.Marker;
  private mapInitTimeout?: ReturnType<typeof setTimeout>;
  private mapInvalidateTimeout?: ReturnType<typeof setTimeout>;
  private mapInitQueued = false;
  private readonly defaultLocation: L.LatLngTuple = [27.7172, 85.324];
  private readonly tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  readonly propertyTypes: SelectOption<PropertyType>[] = [
    { label: 'House', value: 'house' },
    { label: 'Apartment', value: 'apartment' },
    { label: 'Land', value: 'land' },
    { label: 'Commercial', value: 'commercial' },
  ];

  readonly listingTypes: SelectOption<ListingType>[] = [
    { label: 'For Sale', value: 'sale' },
    { label: 'For Rent', value: 'rent' },
  ];

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly editingProperty = signal<Property | null>(null);
  readonly selectedFiles = signal<File[]>([]);
  readonly selectedFilePreviews = signal<string[]>([]);

  readonly isEditMode = computed(() => !!this.editingProperty());
  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'Edit Property' : 'Upload Property',
  );
  readonly form = this.fb.group({
    title: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    description: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(24)],
    }),
    type: this.fb.control<PropertyType>('house', {
      nonNullable: true,
      validators: Validators.required,
    }),
    listingType: this.fb.control<ListingType>('sale', {
      nonNullable: true,
      validators: Validators.required,
    }),
    price: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    area: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    aana: this.fb.control<number | null>(null, [Validators.min(0)]),
    bedrooms: this.fb.control<number | null>(null, [Validators.min(0)]),
    bathrooms: this.fb.control<number | null>(null, [Validators.min(0)]),
    floors: this.fb.control<number | null>(null, [Validators.min(0)]),
    district: this.fb.control('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    city: this.fb.control('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    address: this.fb.control('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    lat: this.fb.control(27.7172, {
      nonNullable: true,
      validators: Validators.required,
    }),
    lng: this.fb.control(85.324, {
      nonNullable: true,
      validators: Validators.required,
    }),
    imagesRaw: this.fb.control('', { nonNullable: true }),
    featuresRaw: this.fb.control('', { nonNullable: true }),
  });

  get selectedLocationLabel(): string {
    return `${this.form.controls.lat.value.toFixed(6)}, ${this.form.controls.lng.value.toFixed(6)}`;
  }

  ngOnInit(): void {
    const propertyId = Number(this.route.snapshot.paramMap.get('id'));
    if (propertyId) {
      this.loadProperty(propertyId);
    }
  }

  ngAfterViewChecked(): void {
    if (this.locationMap || this.mapInitQueued || !this.locationMapContainer)
      return;

    this.mapInitQueued = true;
    this.mapInitTimeout = setTimeout(() => {
      this.initLocationMap();
    }, 0);
  }

  saveProperty(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.hasImages()) {
      this.snackBar.open('Add at least one image before saving', 'Close', {
        duration: 3000,
      });
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.router.navigate(['/login']);
      return;
    }

    const payload = this.buildPayload();
    const existing = this.editingProperty();

    this.saving.set(true);
    const request = existing
      ? this.propertyService.updateProperty(existing.id, payload)
      : this.propertyService.createProperty(payload);

    request.subscribe({
      next: (property) => this.uploadImagesAndFinish(property, !!existing),
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Unable to save listing', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.mapInitTimeout);
    clearTimeout(this.mapInvalidateTimeout);
    this.locationMap?.remove();
    this.revokeSelectedPreviews();
  }

  resetMapToKathmandu(): void {
    this.setLocationFromMap(this.defaultLocation[0], this.defaultLocation[1], {
      fly: true,
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      this.snackBar.open('Only image files can be uploaded', 'Close', {
        duration: 3000,
      });
    }

    this.revokeSelectedPreviews();
    this.selectedFiles.set(imageFiles);
    this.selectedFilePreviews.set(
      imageFiles.map((file) => URL.createObjectURL(file)),
    );
    input.value = '';
  }

  removeSelectedFile(index: number): void {
    const previews = this.selectedFilePreviews();
    URL.revokeObjectURL(previews[index]);

    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
    this.selectedFilePreviews.update((urls) => urls.filter((_, i) => i !== index));
  }

  getPreviewImages(): string[] {
    return [
      ...this.selectedFilePreviews(),
      ...this.parseList(this.form.controls.imagesRaw.value),
    ];
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private loadProperty(id: number): void {
    const sellerId = this.authService.getCurrentUser()?.id;

    this.loading.set(true);
    this.error.set('');

    this.propertyService.getPropertyById(id).subscribe({
      next: (property) => {
        if (sellerId && property.sellerId !== sellerId) {
          this.error.set('You do not have access to edit this listing.');
          this.loading.set(false);
          return;
        }

        this.editingProperty.set(property);
        this.form.patchValue({
          title: property.title,
          description: property.description,
          type: property.type,
          listingType: property.listingType,
          price: property.price,
          area: property.area,
          aana: property.aana,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          floors: property.floors,
          district: property.location.district,
          city: property.location.city,
          address: property.location.address,
          lat: property.location.lat,
          lng: property.location.lng,
          imagesRaw: property.images.join('\n'),
          featuresRaw: property.features.join(', '),
        });
        this.setLocationFromMap(property.location.lat, property.location.lng, {
          fly: true,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load this listing.');
        this.loading.set(false);
      },
    });
  }

  private buildPayload(): CreatePropertyPayload {
    const value = this.form.getRawValue();

    return {
      title: value.title.trim(),
      description: value.description.trim(),
      type: value.type,
      listingType: value.listingType,
      price: this.toNumber(value.price),
      area: this.toNumber(value.area),
      aana: this.toNumber(value.aana),
      bedrooms: this.toNumber(value.bedrooms),
      bathrooms: this.toNumber(value.bathrooms),
      floors: this.toNumber(value.floors),
      location: {
        district: value.district.trim(),
        city: value.city.trim(),
        address: value.address.trim(),
        lat: Number(value.lat),
        lng: Number(value.lng),
      },
      images: this.parseList(value.imagesRaw),
      features: this.parseList(value.featuresRaw),
    };
  }

  private parseList(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toNumber(value: number | null | undefined): number {
    return Number(value ?? 0);
  }

  private hasImages(): boolean {
    return (
      this.selectedFiles().length > 0 ||
      this.parseList(this.form.controls.imagesRaw.value).length > 0
    );
  }

  private uploadImagesAndFinish(property: Property, wasEditing: boolean): void {
    of(property)
      .pipe(
        switchMap((savedProperty) => {
          const files = this.selectedFiles();
          if (!files.length) return of(savedProperty);
          return this.propertyService.uploadPropertyImages(
            savedProperty.id,
            files,
          );
        }),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.revokeSelectedPreviews();
          this.selectedFiles.set([]);
          this.selectedFilePreviews.set([]);
          this.snackBar.open(
            wasEditing ? 'Listing updated' : 'Listing submitted for review',
            'Close',
            {
              duration: 3000,
              horizontalPosition: 'start',
              verticalPosition: 'bottom',
            },
          );
          this.router.navigate(['/seller/properties']);
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open(
            'Listing saved, but image upload failed. Please edit and try again.',
            'Close',
            { duration: 4500 },
          );
        },
      });
  }

  private revokeSelectedPreviews(): void {
    this.selectedFilePreviews().forEach((url) => URL.revokeObjectURL(url));
  }

  private initLocationMap(): void {
    this.mapInitQueued = false;
    if (!this.locationMapContainer || this.locationMap) return;
    const mapElement = this.locationMapContainer.nativeElement;
    if (!mapElement.offsetWidth || !mapElement.offsetHeight) {
      this.mapInitQueued = true;
      this.mapInitTimeout = setTimeout(() => this.initLocationMap(), 80);
      return;
    }

    const lat = this.form.controls.lat.value || this.defaultLocation[0];
    const lng = this.form.controls.lng.value || this.defaultLocation[1];

    this.locationMap = L.map(mapElement, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer(this.tileUrl, {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
      minZoom: 8,
    }).addTo(this.locationMap);

    this.locationMarker = L.marker([lat, lng], {
      icon: this.createLocationIcon(),
      draggable: true,
    }).addTo(this.locationMap);

    this.locationMarker.on('dragend', () => {
      const point = this.locationMarker?.getLatLng();
      if (!point) return;
      this.setLocationFromMap(point.lat, point.lng);
    });

    this.locationMap.on('click', (event: L.LeafletMouseEvent) => {
      this.setLocationFromMap(event.latlng.lat, event.latlng.lng);
    });

    this.mapInvalidateTimeout = setTimeout(() => {
      this.locationMap?.invalidateSize();
      this.locationMap?.setView([lat, lng], 13);
    }, 160);
  }

  private setLocationFromMap(
    lat: number,
    lng: number,
    options: { fly?: boolean } = {},
  ): void {
    const nextLat = Number(lat.toFixed(6));
    const nextLng = Number(lng.toFixed(6));

    this.form.controls.lat.setValue(nextLat);
    this.form.controls.lng.setValue(nextLng);

    const nextLocation: L.LatLngTuple = [nextLat, nextLng];
    this.locationMarker?.setLatLng(nextLocation);

    if (options.fly) {
      this.locationMap?.flyTo(nextLocation, 15, { animate: true });
    }
  }

  private createLocationIcon(): L.DivIcon {
    return L.divIcon({
      className: 'seller-location-pin',
      html: '<span></span>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
  }
}
