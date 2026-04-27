import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'propertyType',
  standalone: true,
})
export class PropertyTypePipe implements PipeTransform {
  private typeMap: Record<string, string> = {
    house: 'House',
    apartment: 'Apartment',
    land: 'Land',
    commercial: 'Commercial',
  };

  private listingTypeMap: Record<string, string> = {
    sale: 'For Sale',
    rent: 'For Rent',
  };

  transform(value: string, type: 'propertyType' | 'listingType' = 'propertyType'): string {
    if (type === 'listingType') {
      return this.listingTypeMap[value] || value;
    }
    return this.typeMap[value] || value;
  }
}