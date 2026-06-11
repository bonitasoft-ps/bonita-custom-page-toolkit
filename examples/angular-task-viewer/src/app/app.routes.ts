import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./pages/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/tasks.page').then((m) => m.TasksPage) },
      { path: 'tasks', loadComponent: () => import('./pages/tasks.page').then((m) => m.TasksPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
