# Implementation Plan: Avento Native Mobile App

## Overview

This plan implements a React Native (Expo SDK 51+) Android application with role-based navigation for Parent, Admin, and SuperAdmin users. The implementation follows a layered architecture (UI → State → Service → Platform) using Zustand for global state, React Query for server cache, axios for HTTP, and expo-secure-store for sensitive data. Tasks are ordered to build foundational layers first, then progressively add screens and features.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Expo project and configure dependencies
    - Run `npx create-expo-app@latest avento-mobile --template blank-typescript`
    - Install core dependencies: react-navigation, zustand, @tanstack/react-query, axios, expo-secure-store, @react-native-async-storage/async-storage, @react-native-community/netinfo, expo-local-authentication, expo-notifications
    - Configure app.json with app name "Avento", icon, splash screen, Android API level 33 min, target SDK 34, `android.allowBackup: false`
    - Set up EAS build configuration (eas.json) for development APK and production AAB profiles
    - Create directory structure: `src/api/`, `src/stores/`, `src/screens/`, `src/navigation/`, `src/components/`, `src/services/`, `src/types/`, `src/utils/`, `src/__tests__/`
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 20.4_

  - [x] 1.2 Define TypeScript types and interfaces
    - Create `src/types/auth.ts` with AppUser, AppRole, AuthState interfaces
    - Create `src/types/models.ts` with all domain models (PersonWithStatus, AttendanceRecord, Announcement, Notification, LeaveRequest, Group, Person, BulkAttendancePayload, Holiday, AuditLogEntry, AttendanceReport, PlatformStats, OrganizationDetail)
    - Create `src/types/api.ts` with ApiClientConfig, QueuedOperation, OfflineQueueStore, CacheEntry, SecureSession interfaces
    - Create `src/types/navigation.ts` with navigation param list types for all stacks
    - _Requirements: 2.1, 2.2, 2.3, 10.4_

  - [x] 1.3 Set up testing infrastructure
    - Install Jest, @testing-library/react-native, fast-check, msw
    - Configure Jest with React Native preset and TypeScript support
    - Create `jest.config.ts` with module name mapper for RN dependencies
    - Create MSW handlers scaffold in `src/__tests__/mocks/handlers.ts`
    - Create test utilities in `src/__tests__/utils/` for rendering with providers
    - _Requirements: N/A (testing infrastructure)_

- [x] 2. Service layer — API client and interceptors
  - [x] 2.1 Implement axios API client with interceptors
    - Create `src/api/client.ts` with base URL from environment variable (`EXPO_PUBLIC_API_URL`)
    - Implement request interceptor to attach Bearer token from SecureStore
    - Implement request interceptor to attach organization_id header from session
    - Implement response interceptor for 401 → trigger logout flow
    - Implement response interceptor for network/timeout → reject with typed OfflineError
    - Set default timeout to 30,000ms
    - _Requirements: 1.2, 1.6, 24.3_

  - [x] 2.2 Implement API endpoint modules
    - Create `src/api/auth.ts` with login, logout, refreshToken, changePassword, fetchOrganizations
    - Create `src/api/portal.ts` with getPersons, getAttendanceHistory, getAnnouncements, getNotifications, submitLeaveRequest, getLeaveRequests
    - Create `src/api/admin.ts` with getDashboard, getGroups, getGroupMembers, submitBulkAttendance, getPersons, createPerson, updatePerson, deactivatePerson, getLeaveRequests, approveLeave, rejectLeave, getAnnouncements, createAnnouncement, publishAnnouncement, getReports, exportReportPdf, getHolidays, createHoliday, getAuditLogs
    - Create `src/api/superadmin.ts` with getPlatformDashboard, getOrganizations, createOrganization, updateOrganization, getOrganizationDetail
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 6.3, 7.1, 8.2, 9.1, 10.4, 11.1, 11.3, 11.5, 11.6, 12.1, 12.3, 12.5, 13.1, 13.3, 13.4, 14.1, 14.4, 15.2, 15.4, 16.1, 16.3, 17.1, 18.1, 19.1, 19.3, 19.5, 24.1_

- [x] 3. Service layer — Secure storage, offline queue, and push notifications
  - [x] 3.1 Implement secure storage service
    - Create `src/services/secureStorage.ts` with saveToken, getToken, removeToken, saveSession, getSession, clearAll methods
    - Use expo-secure-store with Android Keystore-backed encryption
    - Implement error handling for storage failures (force logout on read errors)
    - _Requirements: 1.2, 20.1, 20.3_

  - [ ]* 3.2 Write property test for token storage round-trip
    - **Property 1: Token storage round-trip**
    - **Validates: Requirements 1.2, 20.1**
    - Use fast-check to generate arbitrary JWT-like strings and verify store → retrieve returns identical value
    - Minimum 100 iterations

  - [x] 3.3 Implement offline queue manager
    - Create `src/stores/offlineQueue.ts` as a Zustand store implementing OfflineQueueStore interface
    - Implement enqueue with UUID generation and timestamp
    - Implement processQueue with chronological ordering (FIFO)
    - Implement idempotency: skip already-processed operations by tracking completed IDs
    - Implement retry logic: max 3 automatic retries with exponential backoff (1s, 2s, 4s)
    - Implement discardItem and retryItem for manual user actions
    - Persist queue to AsyncStorage for survival across app restarts
    - Listen to NetInfo connectivity changes to trigger processQueue on reconnect
    - _Requirements: 21.2, 21.3, 21.4_

  - [ ]* 3.4 Write property tests for offline queue
    - **Property 2: Offline queue ordering preservation**
    - **Validates: Requirements 21.2, 21.3**
    - Use fast-check to generate arbitrary operation sequences and verify chronological order is maintained after processing
    - **Property 3: Offline queue idempotent processing**
    - **Validates: Requirements 21.3, 21.4**
    - Use fast-check to verify re-processing a queue with completed items does not submit duplicates
    - Minimum 100 iterations per property

  - [x] 3.5 Implement push notification service
    - Create `src/services/pushNotifications.ts` implementing PushService interface
    - Implement requestPermissions using expo-notifications
    - Implement registerToken to POST device push token to Backend_API
    - Implement handleNotificationReceived for foreground notifications
    - Implement handleNotificationTapped with deep-link navigation routing
    - Implement unregister for logout cleanup
    - Handle graceful degradation when permissions are denied
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [x] 3.6 Implement biometric authentication service
    - Create `src/services/biometric.ts` with checkAvailability, authenticate, enable, disable methods
    - Use expo-local-authentication to wrap Android BiometricPrompt
    - Handle fallback when biometric hardware is unavailable
    - _Requirements: 1.8, 1.9_

- [x] 4. State layer — Auth store and session management
  - [x] 4.1 Implement auth store with Zustand
    - Create `src/stores/auth.ts` implementing AuthState interface
    - Implement login: call API, store JWT in SecureStore, store user, set isAuthenticated
    - Implement logout: call API logout, clear SecureStore, clear AsyncStorage, reset state
    - Implement refreshToken: call API refresh, update stored token
    - Implement restoreSession: read from SecureStore on app launch, validate token expiry
    - Implement enableBiometric / disableBiometric preference toggle
    - Implement token refresh timer: schedule refresh when remaining TTL ≤ 5 minutes
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 20.3_

  - [ ]* 4.2 Write property tests for auth logic
    - **Property 7: Logout clears all sensitive data**
    - **Validates: Requirements 1.7, 20.3**
    - Use fast-check to generate arbitrary session states and verify logout leaves SecureStore and AsyncStorage empty
    - **Property 8: Token refresh timing**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate arbitrary JWT expiration timestamps and verify refresh triggers if and only if remaining TTL ≤ 5 minutes
    - Minimum 100 iterations per property

- [x] 5. Checkpoint — Core infrastructure verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Navigation layer — Role-based routing
  - [x] 6.1 Implement root navigator and auth flow
    - Create `src/navigation/RootNavigator.tsx` with auth state check
    - Create `src/navigation/AuthStack.tsx` with LoginScreen
    - Create `src/navigation/BiometricScreen.tsx` for biometric gate
    - Implement navigation based on: unauthenticated → AuthStack, biometric required → BiometricScreen, authenticated → role-based tabs
    - _Requirements: 1.1, 1.4, 1.9, 2.4_

  - [x] 6.2 Implement role-based tab navigators
    - Create `src/navigation/ParentTabNavigator.tsx` with tabs: Home, Attendance, Announcements, Leave, Profile
    - Create `src/navigation/AdminTabNavigator.tsx` with tabs: Dashboard, Attendance, Management, Profile
    - Create `src/navigation/SuperAdminTabNavigator.tsx` with tabs: Platform, Organizations, Profile
    - Implement role guard: redirect unauthorized navigation to role's dashboard
    - Use native-stack within each tab for smooth animated transitions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.3 Write property test for role-based navigation isolation
    - **Property 4: Role-based navigation isolation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
    - Use fast-check to generate arbitrary role values and verify accessible tabs match exactly the defined set for that role
    - Minimum 100 iterations

- [x] 7. Shared UI components
  - [x] 7.1 Implement reusable UI components
    - Create `src/components/SkeletonLoader.tsx` for loading states on all screens
    - Create `src/components/OfflineBanner.tsx` for network status indicator with cached data warning
    - Create `src/components/PullToRefresh.tsx` wrapper with RefreshControl
    - Create `src/components/EmptyState.tsx` for screens with no data
    - Create `src/components/ErrorState.tsx` with retry button
    - Create `src/components/StatusBadge.tsx` for color-coded presence status (green/red/yellow/blue)
    - Create `src/components/DateRangePicker.tsx` for date range selection
    - Create `src/components/SearchableDropdown.tsx` for organization/group selection
    - _Requirements: 3.5, 21.1, 23.3, 23.4_

- [x] 8. Login and authentication screens
  - [x] 8.1 Implement login screen
    - Create `src/screens/auth/LoginScreen.tsx` with organization searchable dropdown, email/login ID field, password field, login button
    - Fetch organizations list from `/api/auth/organizations` on mount
    - Implement case-insensitive search filtering for organization dropdown
    - Implement form validation and submit handler calling auth store login
    - Display API error messages (invalid credentials) without exposing internals
    - _Requirements: 1.1, 1.3, 24.1, 24.2, 24.3_

  - [ ]* 8.2 Write property test for organization search filtering
    - **Property 11: Organization search filtering**
    - **Validates: Requirements 24.1, 24.2**
    - Use fast-check to generate arbitrary search strings and organization lists, verify filtered result contains exactly orgs whose name includes search string case-insensitively
    - Minimum 100 iterations

  - [x] 8.3 Implement biometric gate screen
    - Create `src/screens/auth/BiometricScreen.tsx` with biometric prompt on mount
    - Show "Try again" option on failure
    - Provide fallback to credential-based login
    - _Requirements: 1.8, 1.9_

- [x] 9. Parent screens
  - [x] 9.1 Implement Parent Home screen (children status)
    - Create `src/screens/parent/HomeScreen.tsx` with children list and color-coded status indicators
    - Use React Query for data fetching from `/api/portal/persons`
    - Show "Not Marked" for children with no attendance record today
    - Implement pull-to-refresh
    - Show cached data with offline banner when network unavailable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 9.2 Implement Parent Attendance History screen
    - Create `src/screens/parent/AttendanceHistoryScreen.tsx` with calendar view
    - Color-code dates: green (Present), red (Absent), yellow (Late), blue (On_Leave)
    - Implement date range pickers for filtering
    - Display summary: total Present, Absent, Late, On_Leave counts
    - Show empty state when no records exist
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 9.3 Write property test for attendance summary computation
    - **Property 12: Attendance summary computation**
    - **Validates: Requirements 4.4**
    - Use fast-check to generate arbitrary lists of AttendanceRecords and verify computed summary counts match actual counts of each PresenceStatus
    - Minimum 100 iterations

  - [x] 9.4 Implement Parent Announcements screens
    - Create `src/screens/parent/AnnouncementListScreen.tsx` with reverse chronological list, title, body preview, date
    - Create `src/screens/parent/AnnouncementDetailScreen.tsx` with full content
    - Implement tab badge for new announcements
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 9.5 Write property test for chronological list ordering
    - **Property 13: Chronological list ordering**
    - **Validates: Requirements 5.2, 7.2**
    - Use fast-check to generate arbitrary lists of timestamped items and verify displayed order is reverse chronological
    - Minimum 100 iterations

  - [x] 9.6 Implement Parent Leave Request screens
    - Create `src/screens/parent/LeaveListScreen.tsx` with leave requests grouped by status (Pending, Approved, Rejected)
    - Create `src/screens/parent/LeaveFormScreen.tsx` with child selection, start date, end date, reason, leave type fields
    - Implement client-side validation: reject if start_date > end_date or required fields empty
    - Display field-level errors for validation failures
    - Show success confirmation on successful submission
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.7 Write property test for leave request form validation
    - **Property 9: Leave request form validation**
    - **Validates: Requirements 6.2, 6.4**
    - Use fast-check to generate arbitrary form inputs and verify rejection when start_date > end_date or required fields empty, with no API call made
    - Minimum 100 iterations

  - [x] 9.8 Implement Parent Notifications screen
    - Create `src/screens/parent/NotificationsScreen.tsx` with reverse chronological list, infinite scroll pagination
    - Display type, title, body, timestamp for each notification
    - Show unread indicator on notification icon
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.9 Implement Parent Profile and Change Password screens
    - Create `src/screens/shared/ProfileScreen.tsx` with user info, biometric toggle, logout button
    - Create `src/screens/shared/ChangePasswordScreen.tsx` with current password, new password, confirm password fields
    - Implement validation: new password ≥ 6 chars, new password matches confirm password
    - Display error for incorrect current password
    - Show success and redirect on successful change
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.10 Write property test for password change validation
    - **Property 14: Password change validation**
    - **Validates: Requirements 8.2**
    - Use fast-check to generate arbitrary password inputs and verify form is submittable if and only if new password ≥ 6 chars AND new password equals confirm password
    - Minimum 100 iterations

- [x] 10. Checkpoint — Parent flow verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Admin screens — Dashboard and Attendance
  - [x] 11.1 Implement Admin Dashboard screen
    - Create `src/screens/admin/DashboardScreen.tsx` with today's attendance summary
    - Display total students, Present/Absent/Late/On_Leave counts and percentages
    - Display pending leave requests count
    - Display groups not yet marked today count
    - Implement pull-to-refresh
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.2 Implement Admin Attendance Marking flow
    - Create `src/screens/admin/GroupListScreen.tsx` with groups and today's marking status indicator
    - Create `src/screens/admin/BulkMarkingScreen.tsx` with student list, status toggles, submit button
    - Default all students to "Present" on load
    - Allow toggling individual student status (Present, Absent, Late, On_Leave)
    - Support date picker for marking a date other than today
    - Submit bulk attendance as single API call to `/api/attendance/bulk`
    - Show success confirmation with record count on success
    - Retain marked data on failure for retry without re-marking
    - Support groups up to 60 students in a single submission
    - Implement offline queue fallback: enqueue if network unavailable
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 21.2_

  - [ ]* 11.3 Write property tests for bulk attendance
    - **Property 5: Bulk attendance payload completeness**
    - **Validates: Requirements 10.4, 10.5**
    - Use fast-check to generate arbitrary groups of N students and verify payload contains exactly N records with valid statuses and correct group_id/date
    - **Property 6: Attendance default-to-Present invariant**
    - **Validates: Requirements 10.3**
    - Use fast-check to generate arbitrary groups of N persons and verify all initially have status "Present"
    - Minimum 100 iterations per property

- [x] 12. Admin screens — Management
  - [x] 12.1 Implement Admin Student Management screens
    - Create `src/screens/admin/StudentsScreen.tsx` with paginated list, search, filter
    - Create `src/screens/admin/StudentFormScreen.tsx` with create/edit form (name, roll number, admission number, parent mobile, parent email, gender, DOB, guardian name, group assignment)
    - Implement student detail view with groups and parent account status
    - Implement deactivate student action
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 12.2 Implement Admin Group Management screens
    - Create `src/screens/admin/GroupsScreen.tsx` with groups list
    - Create `src/screens/admin/GroupFormScreen.tsx` with name, description fields
    - Create group detail view with member list
    - Implement add/remove members from group
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 12.3 Implement Admin Leave Request Management screen
    - Create `src/screens/admin/LeaveManagementScreen.tsx` with leave requests grouped by status (Pending first)
    - Implement leave request detail view with child name, dates, reason, submission date
    - Implement Approve action (PUT with approved status)
    - Implement Reject action with remarks input field (PUT with rejected status and remarks)
    - Show badge count of pending requests
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 12.4 Implement Admin Announcements screens
    - Create `src/screens/admin/AnnouncementsScreen.tsx` with reverse chronological list showing publication status and target info
    - Create `src/screens/admin/AnnouncementFormScreen.tsx` with title, body, target type (Organization/Group/Person), target selection
    - Implement multi-select group list when target type is "Group"
    - Implement publish action
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 12.5 Implement Admin Reports screen
    - Create `src/screens/admin/ReportsScreen.tsx` with date range filters, group selection
    - Display summary table: student name, Present/Absent/Late/On_Leave counts, percentage
    - Implement "Export PDF" button that requests PDF from API and opens device share sheet
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 12.6 Implement Admin Holidays screen
    - Create `src/screens/admin/HolidaysScreen.tsx` with chronological list
    - Create `src/screens/admin/HolidayFormScreen.tsx` with date, name, description fields
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 12.7 Implement Admin Audit Logs screen
    - Create `src/screens/admin/AuditLogsScreen.tsx` with paginated list
    - Display action type, entity type, user, timestamp per entry
    - Implement infinite scroll for loading next pages
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 13. Checkpoint — Admin flow verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. SuperAdmin screens
  - [x] 14.1 Implement SuperAdmin Platform Dashboard screen
    - Create `src/screens/superadmin/PlatformDashboardScreen.tsx`
    - Display total organizations, total users, total persons, today's platform-wide attendance stats
    - Implement pull-to-refresh
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 14.2 Implement SuperAdmin Organization Management screens
    - Create `src/screens/superadmin/OrgListScreen.tsx` with all organizations
    - Create `src/screens/superadmin/OrgFormScreen.tsx` with name, plan type, configuration fields
    - Create `src/screens/superadmin/OrgDetailScreen.tsx` with user count, person count, plan info
    - Implement edit organization details
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 15. Integration wiring and cross-cutting concerns
  - [ ] 15.1 Wire push notification deep-linking to navigation
    - Configure notification handlers in App entry point
    - Map notification types to target screens (attendance → AttendanceHistory, announcement → AnnouncementDetail)
    - Register push token on first login
    - Unregister push token on logout
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [x] 15.2 Wire React Query caching and offline support
    - Configure QueryClient with staleTime, cacheTime, and offline persistence via AsyncStorage
    - Implement background refetch on screen focus for stale data
    - Wire OfflineBanner component visibility to NetInfo connectivity state
    - Ensure each screen shows cached data immediately, then background-refreshes
    - _Requirements: 21.1, 21.5, 23.1_

  - [x] 15.3 Wire navigation state persistence
    - Implement AsyncStorage-backed navigation state persistence
    - Restore last viewed screen on app resume from background
    - _Requirements: 23.5_

  - [x] 15.4 Implement root-detected warning
    - Check for rooted device on app launch
    - Display warning banner if root is detected
    - _Requirements: 20.5_

  - [ ]* 15.5 Write property test for cache staleness indicator
    - **Property 10: Cache staleness indicator presence**
    - **Validates: Requirements 3.5, 21.1**
    - Use fast-check to generate arbitrary offline/online states with cached data and verify offline indicator is rendered when device is offline with cached data
    - Minimum 100 iterations

- [x] 16. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design document using fast-check with 100+ iterations
- Unit tests validate specific examples and edge cases
- The app uses TypeScript throughout — all code examples and implementations should use TypeScript
- The existing `parent-app` PWA in the repo can be used as reference for API contracts and patterns
- All API endpoints communicate with the existing backend at `https://avento-api.onrender.com` — no backend changes required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "3.3", "3.5", "3.6"] },
    { "id": 4, "tasks": ["3.4", "4.1"] },
    { "id": 5, "tasks": ["4.2", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.1"] },
    { "id": 7, "tasks": ["6.3", "8.1", "8.3"] },
    { "id": 8, "tasks": ["8.2", "9.1", "9.4", "9.6", "9.8", "9.9"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.5", "9.7", "9.10"] },
    { "id": 10, "tasks": ["11.1", "11.2"] },
    { "id": 11, "tasks": ["11.3", "12.1", "12.2", "12.3", "12.4", "12.5", "12.6", "12.7"] },
    { "id": 12, "tasks": ["14.1", "14.2"] },
    { "id": 13, "tasks": ["15.1", "15.2", "15.3", "15.4"] },
    { "id": 14, "tasks": ["15.5"] }
  ]
}
```
