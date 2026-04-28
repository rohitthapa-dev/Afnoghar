import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyerPropertyDetailComponent } from './buyer-property-detail.component';

describe('BuyerPropertyDetailComponent', () => {
  let component: BuyerPropertyDetailComponent;
  let fixture: ComponentFixture<BuyerPropertyDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerPropertyDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuyerPropertyDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
