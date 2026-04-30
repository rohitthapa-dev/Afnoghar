import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  FavoriteToggleEvent,
  PropertyCardComponent,
} from '../../../shared/components/property-card/property-card.component';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuthService } from '../../../core/services/auth.service';
import { Property } from '../../../core/models/property.model';

@Component({
  selector: 'app-buyer-favorites',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    PropertyCardComponent,
  ],
  templateUrl: './buyer-favorites.component.html',
  styleUrl: './buyer-favorites.component.scss',
})
export class BuyerFavoritesComponent implements OnInit {
  private favoritesService = inject(FavoritesService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  favoriteProperties = signal<Property[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadFavorites();
  }

  private getUserId(): number | null {
    return this.authService.getCurrentUser()?.id ?? null;
  }

  private loadFavorites(): void {
    const userId = this.getUserId();
    if (!userId) {
      this.favoriteProperties.set([]);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.favoritesService.getFavoriteProperties(userId).subscribe({
      next: (properties) => {
        this.favoriteProperties.set(properties);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onFavoriteToggled(event: FavoriteToggleEvent): void {
    const userId = this.getUserId();
    if (!userId) return;

    if (event.action === 'added') {
      this.favoriteProperties.update(props => {
        const alreadyVisible = props.some(p => p.id === event.property.id);
        return alreadyVisible ? props : [event.property, ...props];
      });
      return;
    }

    this.favoriteProperties.update(props =>
      props.filter(p => p.id !== event.property.id)
    );

    this.snackBar.open('Removed from favorites', 'Undo', {
      duration: 3000,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
    }).onAction().subscribe(() => {
      this.favoritesService.toggleFavorite(event.property.id, userId).subscribe({
        next: (result) => {
          if (result.action === 'added') {
            this.favoriteProperties.update(props => {
              const alreadyVisible = props.some(
                p => p.id === event.property.id
              );

              return alreadyVisible ? props : [event.property, ...props];
            });
          }
        },
        error: () => this.loadFavorites(),
      });
    });
  }
}
