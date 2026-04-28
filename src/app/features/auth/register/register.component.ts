import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [Validators.required, Validators.pattern(/^(98\d{8}|9\d{9})$/)],
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      role: ['buyer', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: this.passwordMatchValidator },
  );

  loading = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  roles = [
    {
      value: 'buyer',
      label: 'Buyer',
      icon: 'search',
      description: 'Looking to buy or rent properties',
    },
    {
      value: 'seller',
      label: 'Seller',
      icon: 'sell',
      description: 'List and sell your properties',
    },
  ];

  get name() {
    return this.registerForm.get('name');
  }
  get email() {
    return this.registerForm.get('email');
  }
  get phone() {
    return this.registerForm.get('phone');
  }
  get password() {
    return this.registerForm.get('password');
  }
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
  get role() {
    return this.registerForm.get('role');
  }
  get terms() {
    return this.registerForm.get('terms');
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { name, email, phone, password, role } = this.registerForm.value;

    this.authService
      .register({ name, email, phone, password, role })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.redirectByRole(response.user.role);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            err?.error?.message || 'Registration failed. Please try again.';
        },
      });
  }

  private redirectByRole(role: string): void {
    switch (role) {
      case 'seller':
        this.router.navigate(['/seller/dashboard']);
        break;
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'buyer':
      default:
        this.router.navigate(['/buyer/home']);
    }
  }
}
