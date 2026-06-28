/**
 * ProtectedRoute — guards authenticated routes by checking auth state and role.
 *
 * - Shows a loading indicator while auth check is in progress.
 * - Redirects unauthenticated users to the login page.
 * - Optionally checks user role against allowedRoles.
 * - Renders nested routes (via Outlet) for authorized users.
 *
 * Validates: Requirements 2.5
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../api/types';

interface ProtectedRouteProps {
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

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

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
