import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyerAppointmentsComponent } from './buyer-appointments.component';

describe('BuyerAppointmentsComponent', () => {
  let component: BuyerAppointmentsComponent;
  let fixture: ComponentFixture<BuyerAppointmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerAppointmentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuyerAppointmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
