import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellerAppointmentsComponent } from './seller-appointments.component';

describe('SellerAppointmentsComponent', () => {
  let component: SellerAppointmentsComponent;
  let fixture: ComponentFixture<SellerAppointmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerAppointmentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellerAppointmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
