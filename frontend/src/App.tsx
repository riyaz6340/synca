import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import PortalLayout from './layouts/PortalLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import PersonsPage from './pages/admin/PersonsPage'
import GroupsPage from './pages/admin/GroupsPage'
import AttendancePage from './pages/admin/AttendancePage'
import LeaveRequestsPage from './pages/admin/LeaveRequestsPage'
import HolidaysPage from './pages/admin/HolidaysPage'
import AnnouncementsPage from './pages/admin/AnnouncementsPage'
import ReportsPage from './pages/admin/ReportsPage'
import ChannelsPage from './pages/admin/ChannelsPage'
import UndeliverablePage from './pages/admin/UndeliverablePage'
import RoleTemplateListPage from './pages/admin/RoleTemplateListPage'
import RoleTemplateFormPage from './pages/admin/RoleTemplateFormPage'
import TeacherListPage from './pages/admin/TeacherListPage'
import TeacherFormPage from './pages/admin/TeacherFormPage'
import TeacherPermissionsPage from './pages/admin/TeacherPermissionsPage'
import TeacherGroupsPage from './pages/admin/TeacherGroupsPage'
import SequentialAttendancePage from './pages/admin/SequentialAttendancePage'
import AttendanceSummaryPage from './pages/admin/AttendanceSummaryPage'
import BrandingSettings from './pages/admin/BrandingSettings'
import PortalPersonsPage from './pages/portal/PersonsPage'
import PortalNotificationsPage from './pages/portal/NotificationsPage'
import PortalAnnouncementsPage from './pages/portal/AnnouncementsPage'
import PortalLeaveRequestsPage from './pages/portal/LeaveRequestsPage'
import PlatformDashboard from './pages/superadmin/PlatformDashboard'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Super Admin routes - founder only */}
      <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']} />}>
        <Route path="/super-admin" element={<PlatformDashboard />} />
      </Route>

      {/* Admin routes - protected, Admin and Teacher roles */}
      <Route element={<ProtectedRoute allowedRoles={['Admin', 'Teacher']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="persons" element={<PersonsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave-requests" element={<LeaveRequestsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="undeliverable" element={<UndeliverablePage />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route path="teachers" element={<TeacherListPage />} />
          <Route path="teachers/create" element={<TeacherFormPage />} />
          <Route path="teachers/new" element={<TeacherFormPage />} />
          <Route path="teachers/:id/edit" element={<TeacherFormPage />} />
          <Route path="teachers/:id/permissions" element={<TeacherPermissionsPage />} />
          <Route path="teachers/:id/groups" element={<TeacherGroupsPage />} />
          <Route path="attendance/sequential/:groupId" element={<SequentialAttendancePage />} />
          <Route path="attendance/sequential/:groupId/summary" element={<AttendanceSummaryPage />} />
          <Route path="role-templates" element={<RoleTemplateListPage />} />
          <Route path="role-templates/new" element={<RoleTemplateFormPage />} />
          <Route path="role-templates/:id/edit" element={<RoleTemplateFormPage />} />
          <Route path="branding" element={<BrandingSettings />} />
        </Route>
      </Route>

      {/* Portal routes - protected, Stakeholder role only */}
      <Route element={<ProtectedRoute allowedRoles={['Stakeholder']} />}>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<Navigate to="persons" replace />} />
          <Route path="persons" element={<PortalPersonsPage />} />
          <Route path="notifications" element={<PortalNotificationsPage />} />
          <Route path="announcements" element={<PortalAnnouncementsPage />} />
          <Route path="leave-requests" element={<PortalLeaveRequestsPage />} />
        </Route>
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
