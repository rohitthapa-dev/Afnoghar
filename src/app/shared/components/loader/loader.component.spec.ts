import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  let component: LoaderComponent;
  let fixture: ComponentFixture<LoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoaderComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default diameter of 48', () => {
    expect(component.diameter).toBe(48);
  });

  it('should have default loading state of true', () => {
    expect(component.loading).toBeTrue();
  });

  it('should have loader-container element', () => {
    const loaderEl = fixture.nativeElement.querySelector('.loader-container');
    expect(loaderEl).toBeTruthy();
  });
});
