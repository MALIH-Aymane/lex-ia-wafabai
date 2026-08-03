import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: () => import('./features/dashboard/home/home.component').then(m => m.HomeComponent) },
      { path: 'search', loadComponent: () => import('./features/dashboard/search/search.component').then(m => m.SearchComponent) },
      { path: 'history', loadComponent: () => import('./features/dashboard/history/history.component').then(m => m.HistoryComponent) },
      {
        path: 'jurisprudence',
        loadComponent: () => import('./features/dashboard/jurisprudence/jurisprudence.component').then(m => m.JurisprudenceComponent)
      },
      {
        path: 'my-requests',
        loadComponent: () => import('./features/dashboard/my-requests/my-requests.component').then(m => m.MyRequestsComponent)
      },
      {
        path: 'user-requests',
        loadComponent: () => import('./features/dashboard/user-requests/user-requests.component').then(m => m.UserRequestsComponent),
        canActivate: [roleGuard],
        data: { roles: ['Responsable juridique', 'Administrateur'] }
      },
      {
        path: 'users',
        loadComponent: () => import('./features/dashboard/users/users.component').then(m => m.UsersComponent),
        canActivate: [roleGuard],
        data: { roles: ['Administrateur'] }
      },
      {
        path: 'documents',
        loadComponent: () => import('./features/dashboard/documents/documents.component').then(m => m.DocumentsComponent),
        canActivate: [roleGuard],
        data: { roles: ['Administrateur'] }
      },
      {
        path: 'db-manager',
        loadComponent: () => import('./features/dashboard/db-manager/db-manager.component').then(m => m.DbManagerComponent),
        canActivate: [roleGuard],
        data: { roles: ['Administrateur'] }
      },
      {
        path: 'groupings',
        loadComponent: () => import('./features/dashboard/groupings/groupings.component').then(m => m.GroupingsComponent),
        canActivate: [roleGuard],
        data: { roles: ['Administrateur'] }
      },
      { path: 'profile', loadComponent: () => import('./features/dashboard/profile/profile.component').then(m => m.ProfileComponent) },
      {
        path: 'llm-models',
        loadComponent: () => import('./features/dashboard/llm-models/llm-models.component').then(m => m.LlmModelsComponent),
        canActivate: [roleGuard],
        data: { roles: ['Administrateur'] }
      },
    ]
  },
  { path: '**', redirectTo: '' }
];
