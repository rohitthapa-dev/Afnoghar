import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyerMapSearchComponent } from './buyer-map-search.component';

describe('BuyerMapSearchComponent', () => {
  let component: BuyerMapSearchComponent;
  let fixture: ComponentFixture<BuyerMapSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerMapSearchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerMapSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
