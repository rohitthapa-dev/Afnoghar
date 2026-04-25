import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyerPropertyListComponent } from './buyer-property-list.component';

describe('BuyerPropertyListComponent', () => {
  let component: BuyerPropertyListComponent;
  let fixture: ComponentFixture<BuyerPropertyListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerPropertyListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuyerPropertyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
