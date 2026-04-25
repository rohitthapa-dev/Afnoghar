import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellerMyListingsComponent } from './seller-my-listings.component';

describe('SellerMyListingsComponent', () => {
  let component: SellerMyListingsComponent;
  let fixture: ComponentFixture<SellerMyListingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerMyListingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellerMyListingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
