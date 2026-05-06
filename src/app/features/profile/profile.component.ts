import {
  Component,
  OnInit,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly user = signal(this.authService.getCurrentUser());
  readonly loading = signal(false);
  readonly avatarLoading = signal(false);
  readonly editingProfile = signal(false);
  readonly changingPassword = signal(false);

  profileForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  get userInitials(): string {
    const name = this.user()?.name || 'U';
    const parts = name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  get userRoleColor(): string {
    switch (this.user()?.role) {
      case UserRole.Seller:
        return 'role-seller';
      case UserRole.Admin:
        return 'role-admin';
      default:
        return 'role-buyer';
    }
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.profileForm.patchValue({ name: user.name, phone: user.phone });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file', 'Close', {
        duration: 3000,
      });
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    this.avatarLoading.set(true);
    this.authService.uploadAvatar(formData).subscribe({
      next: (updatedUser) => {
        this.authService.updateCurrentUser(updatedUser);
        this.user.set(updatedUser);
        this.avatarLoading.set(false);
        this.snackBar.open('Avatar updated successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.avatarLoading.set(false);
        this.snackBar.open('Failed to upload avatar', 'Close', {
          duration: 3000,
        });
      },
    });
    input.value = '';
  }

  removeAvatar(): void {
    if (!this.user()?.avatar || this.avatarLoading()) return;

    this.avatarLoading.set(true);
    this.authService.removeAvatar().subscribe({
      next: (updatedUser) => {
        this.authService.updateCurrentUser(updatedUser);
        this.user.set(updatedUser);
        this.avatarLoading.set(false);
        this.snackBar.open('Avatar removed successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.avatarLoading.set(false);
        this.snackBar.open('Failed to remove avatar', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  toggleEditProfile(): void {
    this.editingProfile.set(!this.editingProfile());
    if (!this.editingProfile()) {
      const user = this.authService.getCurrentUser();
      if (user)
        this.profileForm.patchValue({ name: user.name, phone: user.phone });
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const userId = this.user()?.id;
    if (!userId) return;

    this.loading.set(true);
    const { name, phone } = this.profileForm.value;

    this.authService.updateProfile({ name, phone }).subscribe({
      next: (updatedUser) => {
        this.authService.updateCurrentUser(updatedUser);
        this.user.set(updatedUser);
        this.loading.set(false);
        this.editingProfile.set(false);
        this.snackBar.open('Profile updated successfully', 'Close', {
          duration: 3000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to update profile', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  toggleChangePassword(): void {
    this.changingPassword.set(!this.changingPassword());
    if (!this.changingPassword()) this.passwordForm.reset();
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } =
      this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.snackBar.open('New passwords do not match', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.loading.set(true);

    this.authService
      .updateProfile({ password: newPassword, currentPassword })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.changingPassword.set(false);
          this.passwordForm.reset();
          this.snackBar.open('Password changed successfully', 'Close', {
            duration: 3000,
            horizontalPosition: 'start',
            verticalPosition: 'bottom',
          });
        },
        error: (err) => {
          this.loading.set(false);
          const message = err?.error?.message || 'Failed to change password';
          this.snackBar.open(message, 'Close', {
            duration: 3000,
          });
        },
      });
  }
}
