import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { TasksPage } from './pages/TasksPage';
import { Layout } from './pages/Layout';
import { ProtectedRoute } from './pages/ProtectedRoute';

export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <Layout>
          <Outlet />
        </Layout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <TasksPage /> },
      { path: 'tasks', element: <TasksPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
