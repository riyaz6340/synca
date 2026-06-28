/**
 * App shell — configures React Router with multi-role routes.
 *
 * - /login is public
 * - /super-admin requires SuperAdmin role
 * - /admin/* requires Admin role
 * - / (stakeholder routes) require Stakeholder role
 *
 * Validates: Requirements 8.7
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppNav from './components/AppNav';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import StakeholderAttendancePage from './pages/AttendancePage';
import StakeholderAnnouncementsPage from './pages/AnnouncementsPage';
import NotificationsPage from './pages/NotificationsPage';
import StakeholderLeaveRequestsPage from './pages/LeaveRequestsPage';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './pages/admin/DashboardPage';
import AdminPersonsPage from './pages/admin/PersonsPage';
import AdminGroupsPage from './pages/admin/GroupsPage';
import AdminAttendancePage from './pages/admin/AttendancePage';
import AdminLeaveRequestsPage from './pages/admin/LeaveRequestsPage';
import AdminAnnouncementsPage from './pages/admin/AnnouncementsPage';
import AdminReportsPage from './pages/admin/ReportsPage';
import AdminHolidaysPage from './pages/admin/HolidaysPage';

// SuperAdmin pages
import PlatformDashboard from './pages/superadmin/PlatformDashboard';

/**
 * Layout wrapper for authenticated Stakeholder views — renders AppNav + page content.
 */
function StakeholderLayout() {
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

          {/* Super Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']} />}>
            <Route path="/super-admin" element={<PlatformDashboard />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="persons" element={<AdminPersonsPage />} />
              <Route path="groups" element={<AdminGroupsPage />} />
              <Route path="attendance" element={<AdminAttendancePage />} />
              <Route path="leave-requests" element={<AdminLeaveRequestsPage />} />
              <Route path="announcements" element={<AdminAnnouncementsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="holidays" element={<AdminHolidaysPage />} />
            </Route>
          </Route>

          {/* Stakeholder routes (existing parent routes) */}
          <Route element={<ProtectedRoute allowedRoles={['Stakeholder']} />}>
            <Route element={<StakeholderLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/attendance" element={<StakeholderAttendancePage />} />
              <Route path="/announcements" element={<StakeholderAnnouncementsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/leave" element={<StakeholderLeaveRequestsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
