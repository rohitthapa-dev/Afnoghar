export interface PropertyLocation {
  district: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Property {
  id: number;
  title: string;
  description: string;
  type: PropertyType;
  listingType: ListingType;
  price: number;
  area: number;
  aana: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  location: PropertyLocation;
  images: string[];
  features: string[];
  sellerId: number;
  status: PropertyStatus;
  isFeatured: boolean;
  createdAt: string;
}

export type PropertyType = 'house' | 'apartment' | 'land' | 'commercial';

export type ListingType = 'sale' | 'rent';

export type PropertyStatus = 'pending' | 'approved' | 'rejected';

export interface PropertyFilter {
  search?: string;
  type?: PropertyType | '';
  listingType?: ListingType | '';
  district?: string;
  city?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  bedrooms?: number | null;
}

export interface CreatePropertyPayload {
  title: string;
  description: string;
  type: PropertyType;
  listingType: ListingType;
  price: number;
  area: number;
  aana: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  location: PropertyLocation;
  images: string[];
  features: string[];
}
