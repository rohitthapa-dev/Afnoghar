import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found.component';

describe('PageNotFoundComponent', () => {
  let component: PageNotFoundComponent;
  let fixture: ComponentFixture<PageNotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageNotFoundComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PageNotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have goHome method', () => {
    expect(component.goHome).toBeDefined();
  });

  it('should have goBack method', () => {
    expect(component.goBack).toBeDefined();
  });

  it('should have not-found-container element', () => {
    const container = fixture.nativeElement.querySelector('.not-found-container');
    expect(container).toBeTruthy();
  });
});
