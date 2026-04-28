import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellerPropertyUploadComponent } from './seller-property-upload.component';

describe('SellerPropertyUploadComponent', () => {
  let component: SellerPropertyUploadComponent;
  let fixture: ComponentFixture<SellerPropertyUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerPropertyUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellerPropertyUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
