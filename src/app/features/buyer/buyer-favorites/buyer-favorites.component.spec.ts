import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuyerFavoritesComponent } from './buyer-favorites.component';

describe('BuyerFavoritesComponent', () => {
  let component: BuyerFavoritesComponent;
  let fixture: ComponentFixture<BuyerFavoritesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerFavoritesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuyerFavoritesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
