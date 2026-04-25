import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { BuyerHomeComponent } from './features/buyer/home/buyer-home.component';
import { BuyerPropertyListComponent } from './features/buyer/buyer-property-list/buyer-property-list.component';
import { BuyerPropertyDetailComponent } from './features/buyer/buyer-property-detail/buyer-property-detail.component';
import { BuyerFavoritesComponent } from './features/buyer/buyer-favorites/buyer-favorites.component';
import { BuyerAppointmentsComponent } from './features/buyer/buyer-appointments/buyer-appointments.component';
import { BuyerMapSearchComponent } from './features/buyer/buyer-map-search/buyer-map-search.component';
import { SellerDashboardComponent } from './features/seller/dashboard/seller-dashboard.component';
import { SellerMyListingsComponent } from './features/seller/seller-my-listings/seller-my-listings.component';
import { SellerPropertyUploadComponent } from './features/seller/seller-property-upload/seller-property-upload.component';
import { SellerAppointmentsComponent } from './features/seller/seller-appointments/seller-appointments.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { AdminManageListingsComponent } from './features/admin/admin-manage-listings/admin-manage-listings.component';
import { AdminManageUsersComponent } from './features/admin/admin-manage-users/admin-manage-users.component';
import { buyerGuard } from './core/guards/buyer.guard';
import { sellerGuard } from './core/guards/seller.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  {
    path: 'buyer',
    canActivate: [buyerGuard],
    children: [
      { path: 'home', component: BuyerHomeComponent },
      { path: 'properties', component: BuyerPropertyListComponent },
      { path: 'properties/:id', component: BuyerPropertyDetailComponent },
      { path: 'favorites', component: BuyerFavoritesComponent },
      { path: 'appointments', component: BuyerAppointmentsComponent },
      { path: 'map-search', component: BuyerMapSearchComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },

  {
    path: 'seller',
    canActivate: [sellerGuard],
    children: [
      { path: 'dashboard', component: SellerDashboardComponent },
      { path: 'properties', component: SellerMyListingsComponent },
      { path: 'properties/new', component: SellerPropertyUploadComponent },
      { path: 'properties/:id/edit', component: SellerPropertyUploadComponent },
      { path: 'appointments', component: SellerAppointmentsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'listings', component: AdminManageListingsComponent },
      { path: 'users', component: AdminManageUsersComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
