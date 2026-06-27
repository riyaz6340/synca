/**
 * ProtectedRoute — guards authenticated routes by checking auth state.
 *
 * - Shows a loading indicator while auth check is in progress.
 * - Redirects unauthenticated users to the login page.
 * - Renders nested routes (via Outlet) for authenticated users.
 *
 * Validates: Requirements 2.5
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div role="status" aria-label="Checking authentication">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
