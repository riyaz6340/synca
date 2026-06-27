/**
 * App shell — configures React Router with all routes.
 *
 * - /login is public
 * - All other routes are protected via ProtectedRoute
 * - Authenticated views include AppNav for navigation
 *
 * Validates: Requirements 8.7
 */

import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppNav from './components/AppNav';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AttendancePage from './pages/AttendancePage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import NotificationsPage from './pages/NotificationsPage';
import LeaveRequestsPage from './pages/LeaveRequestsPage';

/**
 * Layout wrapper for authenticated views — renders AppNav + page content.
 */
function AuthenticatedLayout() {
  return (
    <div>
      <AppNav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with navigation */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AuthenticatedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/leave" element={<LeaveRequestsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
