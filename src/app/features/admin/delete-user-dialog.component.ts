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

export interface DeleteUserDialogData {
  userName: string;
  userRole: string;
}

@Component({
  selector: 'app-delete-user-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './delete-user-dialog.component.html',
  styleUrl: './delete-user-dialog.component.scss',
})
export class DeleteUserDialogComponent {
  private dialogRef = inject(MatDialogRef<DeleteUserDialogComponent>);
  data = inject<DeleteUserDialogData>(MAT_DIALOG_DATA);

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
