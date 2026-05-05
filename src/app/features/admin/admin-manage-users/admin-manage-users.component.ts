import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { User } from '../../../core/models/user.model';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog.component';
import { ConfirmDeleteDialogData } from '../../../shared/components/confirm-delete-dialog.component';

type UserRoleFilter = 'all' | User['role'];
type UserStatusFilter = 'all' | 'active' | 'inactive';

interface UserTab {
  label: string;
  value: UserRoleFilter;
  icon: string;
}

@Component({
  selector: 'app-admin-manage-users',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './admin-manage-users.component.html',
  styleUrl: './admin-manage-users.component.scss',
})
export class AdminManageUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly tabs: UserTab[] = [
    { label: 'All', value: 'all', icon: 'groups' },
    { label: 'Buyers', value: 'buyer', icon: 'person_search' },
    { label: 'Sellers', value: 'seller', icon: 'real_estate_agent' },
    { label: 'Admins', value: 'admin', icon: 'admin_panel_settings' },
  ];

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly searchTerm = signal('');
  readonly selectedRole = signal<UserRoleFilter>('all');
  readonly selectedStatus = signal<UserStatusFilter>('all');
  readonly updatingIds = signal<Set<number>>(new Set());

  readonly currentAdminId = computed(
    () => this.authService.getCurrentUser()?.id ?? null,
  );

  readonly filteredUsers = computed(() => {
    const role = this.selectedRole();
    const status = this.selectedStatus();
    const term = this.searchTerm().trim().toLowerCase();

    return this.users().filter((user) => {
      const matchesRole = role === 'all' || user.role === role;
      const matchesStatus =
        status === 'all' ||
        (status === 'active' ? user.isActive : !user.isActive);
      const matchesSearch =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.phone.includes(term);

      return matchesRole && matchesStatus && matchesSearch;
    });
  });

  readonly activeCount = computed(
    () => this.users().filter((user) => user.isActive).length,
  );
  readonly inactiveCount = computed(
    () => this.users().length - this.activeCount(),
  );
  readonly sellerCount = computed(() => this.getRoleCount('seller'));
  readonly buyerCount = computed(() => this.getRoleCount('buyer'));

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');

    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.users.set(
          users.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          ),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load users right now.');
        this.loading.set(false);
      },
    });
  }

  selectRole(role: UserRoleFilter): void {
    this.selectedRole.set(role);
  }

  selectStatus(status: UserStatusFilter): void {
    this.selectedStatus.set(status);
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  getTabCount(role: UserRoleFilter): number {
    if (role === 'all') return this.users().length;
    return this.getRoleCount(role);
  }

  getInitials(user: User): string {
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  isCurrentAdmin(user: User): boolean {
    return user.id === this.currentAdminId();
  }

  isUpdating(user: User): boolean {
    return this.updatingIds().has(user.id);
  }

  toggleUserStatus(user: User): void {
    if (this.isCurrentAdmin(user) && user.isActive) {
      this.showMessage('You cannot deactivate your own admin account.');
      return;
    }

    this.patchUser(user, { isActive: !user.isActive }, 'Account updated');
  }

  onRoleChange(user: User, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as User['role'];
    if (role === user.role) return;

    this.patchUser(user, { role }, 'Role updated');
  }

  formatDate(date: string): string {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Date pending';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsed);
  }

  private patchUser(
    user: User,
    payload: Partial<Pick<User, 'role' | 'isActive'>>,
    successMessage: string,
  ): void {
    this.setUpdating(user.id, true);

    this.adminService.updateUser(user.id, payload).subscribe({
      next: (updatedUser) => {
        this.users.update((items) =>
          items.map((item) =>
            item.id === updatedUser.id ? updatedUser : item,
          ),
        );
        this.setUpdating(user.id, false);
        this.showMessage(successMessage);
      },
      error: () => {
        this.setUpdating(user.id, false);
        this.showMessage('Unable to update user.');
      },
    });
  }

  private setUpdating(id: number, updating: boolean): void {
    this.updatingIds.update((current) => {
      const next = new Set(current);
      if (updating) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private getRoleCount(role: User['role']): number {
    return this.users().filter((user) => user.role === role).length;
  }

  openDeleteDialog(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '460px',
      data: {
        title: 'Delete User',
        message: 'Permanently delete',
        itemName: user.name,
        itemRole: user.role,
      } as ConfirmDeleteDialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteUser(user);
      }
    });
  }

  private deleteUser(user: User): void {
    this.setUpdating(user.id, true);

    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.update((items) => items.filter((item) => item.id !== user.id));
        this.setUpdating(user.id, false);
        this.showMessage('User deleted');
      },
      error: () => {
        this.setUpdating(user.id, false);
        this.showMessage('Failed to delete user');
      },
    });
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2800,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
    });
  }
}
