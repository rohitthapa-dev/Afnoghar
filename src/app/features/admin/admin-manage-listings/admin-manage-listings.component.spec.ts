import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminManageListingsComponent } from './admin-manage-listings.component';

describe('AdminManageListingsComponent', () => {
  let component: AdminManageListingsComponent;
  let fixture: ComponentFixture<AdminManageListingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminManageListingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminManageListingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
