import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  readonly user = signal(this.authService.getCurrentUser());

  readonly userInitials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });


  notificationSettings = {
    emailAlerts: true,
    pushNotifications: false,
    smsAlerts: false,
    newListings: true,
    priceChanges: true,
    appointmentUpdates: true,
  };

  preferences = {
    language: 'en',
    currency: 'NPR',
    theme: 'system',
  };

  openDeleteDialog(): void {
    const dialogRef = this.dialog.open(DeleteAccountDialogComponent, {
      width: '460px',
      disableClose: true,
      panelClass: 'delete-account-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteAccount();
      }
    });
  }

  private deleteAccount(): void {
    this.authService.deleteAccount().subscribe({
      next: () => {
        this.snackBar.open('Account deleted successfully', 'Close', {
          duration: 4000,
          horizontalPosition: 'start',
          verticalPosition: 'bottom',
        });
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.snackBar.open('Failed to delete account', 'Close', {
          duration: 4000,
        });
      },
    });
  }
}
