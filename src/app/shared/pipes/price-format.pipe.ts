import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'priceFormat',
  standalone: true,
})
export class PriceFormatPipe implements PipeTransform {
  transform(value: number, listingType: 'sale' | 'rent' | undefined): string {
    if (!value) return 'Price on request';

    if (listingType === 'rent') {
      if (value >= 1000) {
        const formatted = value.toLocaleString('en-NP');
        return `Rs. ${formatted}/month`;
      }
      return `Rs. ${value}`;
    }

    if (value >= 100000) {
      const lakhs = value / 100000;
      if (lakhs >= 100) {
        const crores = lakhs / 100;
        return `Rs. ${this.formatCompactAmount(crores)} Crores`;
      }
      return `Rs. ${this.formatCompactAmount(lakhs)} Lakhs`;
    }

    return `Rs. ${value.toLocaleString('en-NP')}`;
  }

  private formatCompactAmount(value: number): string {
    return value.toLocaleString('en-NP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
}
