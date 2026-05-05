import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-delete-account-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './delete-account-dialog.component.html',
  styleUrl: './delete-account-dialog.component.scss',
})
export class DeleteAccountDialogComponent {
  private dialogRef = inject(MatDialogRef<DeleteAccountDialogComponent>);

  confirmationText = '';
  readonly expectedText = 'DELETE';

  get isConfirmed(): boolean {
    return this.confirmationText === this.expectedText;
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (this.isConfirmed) {
      this.dialogRef.close(true);
    }
  }
}
