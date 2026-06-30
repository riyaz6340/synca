# Requirements Document

## Introduction

This document specifies the requirements for the Avento Native Mobile App — a React Native (Expo) Android application for the Avento People Presence Platform. The app serves three user roles (Parent/Stakeholder, Admin, SuperAdmin) and communicates with the existing backend API deployed at https://avento-api.onrender.com. The primary goal is to deliver a production-quality native mobile experience with fast attendance marking as the top priority workflow, secure multi-tenant data handling, and offline resilience.

## Glossary

- **App**: The React Native (Expo) mobile application for Android
- **Backend_API**: The existing Express.js REST API at https://avento-api.onrender.com
- **Admin**: A school staff user with permissions to manage attendance, persons, groups, announcements, leave requests, reports, and holidays within their organization
- **SuperAdmin**: The platform owner with permissions to manage all organizations and view platform-wide statistics
- **Parent**: A stakeholder user (parent/guardian) with permissions to view their children's attendance, submit leave requests, and read announcements
- **Organization**: A tenant entity (typically a school) with isolated data in the multi-tenant platform
- **Person**: An individual tracked for attendance (typically a student) belonging to an organization
- **Group**: A collection of persons (typically a class/section) within an organization
- **Attendance_Record**: A record of a person's presence status (Present, Absent, Late, On_Leave) for a specific date
- **Leave_Request**: A request submitted by a Parent for their child's absence, requiring Admin approval
- **Announcement**: A message published by an Admin targeted at the organization, specific groups, or specific persons
- **JWT**: JSON Web Token used for stateless authentication with the Backend_API
- **Secure_Storage**: Encrypted device-level storage (expo-secure-store) for sensitive data like tokens
- **Biometric_Auth**: Device biometric authentication (fingerprint or face) used as a convenience login method
- **Offline_Queue**: A local queue of API operations that failed due to network unavailability, to be retried when connectivity is restored

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user (Admin, SuperAdmin, or Parent), I want to securely log into the app with my credentials so that I can access features appropriate to my role.

#### Acceptance Criteria

1. WHEN the user opens the App for the first time, THE App SHALL display a login screen with fields for organization selection, email/login ID, and password.
2. WHEN the user submits valid credentials, THE App SHALL authenticate against the Backend_API `/api/auth/login` endpoint and store the returned JWT in Secure_Storage.
3. WHEN the Backend_API returns an authentication error, THE App SHALL display a clear error message indicating invalid credentials without exposing internal details.
4. WHILE a valid JWT exists in Secure_Storage, THE App SHALL bypass the login screen and navigate directly to the role-appropriate dashboard on app launch.
5. WHEN the JWT is within 5 minutes of expiration, THE App SHALL silently refresh the token using the Backend_API `/api/auth/refresh` endpoint.
6. IF the token refresh fails, THEN THE App SHALL redirect the user to the login screen and clear stored credentials from Secure_Storage.
7. WHEN the user taps the logout button, THE App SHALL call the Backend_API `/api/auth/logout` endpoint, clear all tokens from Secure_Storage, and navigate to the login screen.
8. WHERE biometric authentication is available on the device, THE App SHALL offer the user an option to enable biometric login after successful credential-based authentication.
9. WHILE biometric login is enabled, WHEN the user opens the App, THE App SHALL prompt for biometric verification before granting access to the authenticated session.

### Requirement 2: Role-Based Navigation

**User Story:** As a user, I want the app to show me only the screens and features relevant to my role so that I can efficiently access my workflows without confusion.

#### Acceptance Criteria

1. WHEN a Parent authenticates successfully, THE App SHALL display a bottom tab navigator with tabs for Home (children status), Attendance History, Announcements, Leave Requests, and Profile.
2. WHEN an Admin authenticates successfully, THE App SHALL display a bottom tab navigator with tabs for Dashboard, Attendance (marking), Management, and Profile.
3. WHEN a SuperAdmin authenticates successfully, THE App SHALL display a bottom tab navigator with tabs for Platform Dashboard, Organizations, and Profile.
4. THE App SHALL use native stack navigation with smooth animated transitions between screens within each tab.
5. IF a user attempts to access a screen outside their role permissions, THEN THE App SHALL redirect the user to their role-appropriate dashboard.

### Requirement 3: Parent — Children Presence Status

**User Story:** As a Parent, I want to see my children's current attendance status at a glance so that I know whether they arrived at school today.

#### Acceptance Criteria

1. WHEN a Parent navigates to the Home screen, THE App SHALL fetch the children list with current status from the Backend_API `/api/portal/persons` endpoint.
2. THE App SHALL display each child's name, relationship, and today's presence status (Present, Absent, Late, On_Leave, or Not Marked) with a color-coded indicator.
3. WHEN the Backend_API returns no attendance record for today for a child, THE App SHALL display "Not Marked" as the status.
4. WHEN the Parent performs a pull-to-refresh gesture on the Home screen, THE App SHALL re-fetch the latest data from the Backend_API.
5. IF the network request fails, THEN THE App SHALL display the last cached data with a banner indicating the data may be outdated, and provide a retry button.

### Requirement 4: Parent — Attendance History

**User Story:** As a Parent, I want to view my child's attendance history with date range filtering so that I can track attendance patterns over time.

#### Acceptance Criteria

1. WHEN a Parent selects a child and navigates to the Attendance History screen, THE App SHALL fetch attendance records from the Backend_API `/api/portal/persons/:id/attendance` endpoint.
2. THE App SHALL display attendance records in a calendar view with color-coded dates (green for Present, red for Absent, yellow for Late, blue for On_Leave).
3. WHEN the Parent selects a date range using start and end date pickers, THE App SHALL filter the displayed records and re-fetch data with `start_date` and `end_date` query parameters.
4. THE App SHALL display a summary showing total days Present, Absent, Late, and On_Leave for the selected period.
5. IF no attendance records exist for the selected period, THEN THE App SHALL display an empty state message indicating no records were found.

### Requirement 5: Parent — Announcements

**User Story:** As a Parent, I want to read announcements from my child's school so that I stay informed about events, holidays, and important notices.

#### Acceptance Criteria

1. WHEN a Parent navigates to the Announcements screen, THE App SHALL fetch announcements from the Backend_API `/api/portal/announcements` endpoint.
2. THE App SHALL display announcements in reverse chronological order with title, body preview, and publication date.
3. WHEN the Parent taps on an announcement, THE App SHALL navigate to a detail screen showing the full announcement content.
4. WHEN new announcements are fetched that were not previously displayed, THE App SHALL show a badge count on the Announcements tab.

### Requirement 6: Parent — Leave Requests

**User Story:** As a Parent, I want to submit leave requests for my child and track their approval status so that I can formally notify the school about planned absences.

#### Acceptance Criteria

1. WHEN a Parent navigates to the Leave Requests screen, THE App SHALL fetch existing leave requests from the Backend_API `/api/leave-requests` endpoint and display them grouped by status (Pending, Approved, Rejected).
2. WHEN a Parent taps the "New Leave Request" button, THE App SHALL display a form with fields for child selection, start date, end date, reason, and leave type.
3. WHEN the Parent submits a valid leave request form, THE App SHALL POST the data to the Backend_API `/api/leave-requests` endpoint and display a success confirmation.
4. IF the leave request submission fails due to validation errors, THEN THE App SHALL display field-level error messages indicating the required corrections.
5. THE App SHALL display each leave request with its current status (Pending, Approved, Rejected), date range, reason, and any admin remarks.

### Requirement 7: Parent — Notifications

**User Story:** As a Parent, I want to receive and view notifications from the school so that I am promptly informed about my child's attendance and school updates.

#### Acceptance Criteria

1. WHEN a Parent navigates to the Notifications section, THE App SHALL fetch notifications from the Backend_API `/api/portal/notifications` endpoint with pagination support.
2. THE App SHALL display notifications in reverse chronological order with type, title, body, and timestamp.
3. WHEN more notifications are available beyond the current page, THE App SHALL load additional notifications as the user scrolls (infinite scroll).
4. THE App SHALL display an unread indicator on the notification icon when new notifications exist.

### Requirement 8: Parent — Change Password

**User Story:** As a Parent, I want to change my account password from within the app so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a Parent navigates to Profile and taps "Change Password", THE App SHALL display a form with fields for current password, new password, and confirm new password.
2. WHEN the Parent submits the form with matching new password and confirm password fields of at least 6 characters, THE App SHALL POST to the Backend_API `/api/auth/change-password` endpoint.
3. IF the current password is incorrect, THEN THE App SHALL display an error message indicating the current password is wrong.
4. WHEN the password change succeeds, THE App SHALL display a success message and redirect to the Profile screen.

### Requirement 9: Admin — Dashboard

**User Story:** As an Admin, I want to see a summary dashboard with today's attendance statistics so that I can quickly understand the school's current attendance status.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Dashboard screen, THE App SHALL fetch today's attendance summary data from the Backend_API.
2. THE App SHALL display the total number of students, count and percentage of students marked Present, Absent, Late, and On_Leave for today.
3. THE App SHALL display the number of pending leave requests awaiting approval.
4. THE App SHALL display the count of groups (classes) that have not yet been marked for today.
5. WHEN the Admin performs a pull-to-refresh gesture, THE App SHALL re-fetch all dashboard data from the Backend_API.

### Requirement 10: Admin — Attendance Marking

**User Story:** As an Admin, I want to quickly mark attendance for an entire class at once so that the daily attendance workflow takes minimal time and effort.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Attendance screen, THE App SHALL display a list of all groups (classes) with an indicator showing whether attendance has been marked for today.
2. WHEN the Admin selects a group, THE App SHALL fetch the list of active persons in that group and display them with checkboxes or toggle controls for presence status.
3. THE App SHALL default all students in the group to "Present" status, allowing the Admin to mark exceptions (Absent, Late) by tapping individual students.
4. WHEN the Admin taps "Submit Attendance", THE App SHALL POST bulk attendance data to the Backend_API `/api/attendance/bulk` endpoint with the group ID, date, and individual statuses.
5. THE App SHALL complete the bulk attendance submission for a group of up to 60 students in a single API call without requiring multiple screens or steps.
6. WHEN the bulk submission succeeds, THE App SHALL display a success confirmation with the count of records created and navigate back to the group list.
7. IF the bulk submission fails, THEN THE App SHALL display an error message and retain the marked data so the Admin can retry without re-marking.
8. WHEN the Admin needs to mark individual exceptions after bulk marking, THE App SHALL allow tapping a student to toggle between Present, Absent, Late, and On_Leave statuses before submission.
9. THE App SHALL support marking attendance for a date other than today by providing a date picker on the attendance screen.

### Requirement 11: Admin — Student Management

**User Story:** As an Admin, I want to manage students (create, view, edit, deactivate) from the app so that I can maintain the student roster without needing a desktop computer.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Students screen, THE App SHALL fetch and display a paginated list of persons from the Backend_API `/api/persons` endpoint with search and filter capabilities.
2. WHEN the Admin taps "Add Student", THE App SHALL display a form with fields for name, roll number, admission number, parent mobile, parent email, gender, date of birth, guardian name, and group assignment.
3. WHEN the Admin submits a valid student creation form, THE App SHALL POST the data to the Backend_API `/api/persons` endpoint and display the created student record.
4. WHEN the Admin taps on a student in the list, THE App SHALL navigate to a detail screen showing the student's information, associated groups, and parent account status.
5. WHEN the Admin edits and saves student information, THE App SHALL PUT the updated data to the Backend_API `/api/persons/:id` endpoint.
6. WHEN the Admin deactivates a student, THE App SHALL PATCH the Backend_API `/api/persons/:id/deactivate` endpoint and update the list to reflect the deactivated status.

### Requirement 12: Admin — Group Management

**User Story:** As an Admin, I want to manage groups (classes) and their members from the app so that I can organize students into classes for attendance marking.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Groups screen, THE App SHALL fetch and display all groups from the Backend_API `/api/groups` endpoint.
2. WHEN the Admin taps "Add Group", THE App SHALL display a form with fields for group name and description.
3. WHEN the Admin submits a valid group creation form, THE App SHALL POST the data to the Backend_API `/api/groups` endpoint and display the created group.
4. WHEN the Admin taps on a group, THE App SHALL display the group details and a list of members (persons) assigned to that group.
5. WHEN the Admin adds or removes members from a group, THE App SHALL update the Backend_API `/api/groups/:id/members` endpoint accordingly.

### Requirement 13: Admin — Leave Request Management

**User Story:** As an Admin, I want to approve or reject parent leave requests from the app so that I can process requests promptly without delay.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Leave Requests screen, THE App SHALL fetch leave requests from the Backend_API `/api/leave-requests` endpoint and display them grouped by status with Pending requests first.
2. WHEN the Admin taps on a pending leave request, THE App SHALL display the full request details including child name, dates, reason, and submission date.
3. WHEN the Admin taps "Approve" on a leave request, THE App SHALL PUT to the Backend_API `/api/leave-requests/:id` with approved status and update the list.
4. WHEN the Admin taps "Reject" on a leave request, THE App SHALL display a remarks input field and PUT to the Backend_API `/api/leave-requests/:id` with rejected status and remarks.
5. THE App SHALL display a badge count of pending leave requests on the relevant navigation element.

### Requirement 14: Admin — Announcements

**User Story:** As an Admin, I want to create and publish announcements from the app so that I can communicate with parents about school events and notices.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Announcements screen, THE App SHALL fetch and display announcements from the Backend_API `/api/announcements` endpoint in reverse chronological order.
2. WHEN the Admin taps "New Announcement", THE App SHALL display a form with fields for title, body, target type (Organization, Group, or Person), and target selection.
3. WHEN the Admin selects "Group" as target type, THE App SHALL display a multi-select list of available groups for targeting.
4. WHEN the Admin submits a valid announcement, THE App SHALL POST to the Backend_API `/api/announcements` endpoint and optionally publish immediately via the publish endpoint.
5. THE App SHALL display each announcement with its publication status (Draft or Published), target information, and creation date.

### Requirement 15: Admin — Attendance Reports

**User Story:** As an Admin, I want to generate attendance reports with date range and group filters so that I can analyze attendance patterns and share reports with management.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Reports screen, THE App SHALL display filter controls for date range (start date, end date) and group selection.
2. WHEN the Admin applies filters and taps "Generate Report", THE App SHALL fetch report data from the Backend_API `/api/reports/attendance` endpoint.
3. THE App SHALL display the report as a summary table showing each student's attendance count (Present, Absent, Late, On_Leave) and percentage for the selected period.
4. WHEN the Admin taps "Export PDF", THE App SHALL request the PDF export from the Backend_API and open the device share sheet to allow saving or sharing the file.

### Requirement 16: Admin — Holiday Management

**User Story:** As an Admin, I want to manage school holidays from the app so that holidays are correctly reflected in attendance records and reports.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Holidays screen, THE App SHALL fetch and display all holidays from the Backend_API `/api/holidays` endpoint.
2. WHEN the Admin taps "Add Holiday", THE App SHALL display a form with fields for date, name, and description.
3. WHEN the Admin submits a valid holiday form, THE App SHALL POST to the Backend_API `/api/holidays` endpoint and update the displayed list.
4. THE App SHALL display holidays in chronological order with date, name, and description.

### Requirement 17: Admin — Audit Logs

**User Story:** As an Admin, I want to view audit logs so that I can track actions performed within the system for accountability and troubleshooting.

#### Acceptance Criteria

1. WHEN an Admin navigates to the Audit Logs screen, THE App SHALL fetch audit log entries from the Backend_API `/api/audit-logs` endpoint with pagination.
2. THE App SHALL display each log entry with action type, entity type, user who performed the action, and timestamp.
3. WHEN the Admin scrolls to the bottom of the list, THE App SHALL load the next page of audit log entries.

### Requirement 18: SuperAdmin — Platform Dashboard

**User Story:** As a SuperAdmin, I want to see platform-wide statistics so that I can monitor the health and growth of all organizations on the platform.

#### Acceptance Criteria

1. WHEN a SuperAdmin navigates to the Platform Dashboard, THE App SHALL fetch platform statistics from the Backend_API `/api/super-admin/dashboard` endpoint.
2. THE App SHALL display total organizations count, total users count, total persons count, and today's platform-wide attendance statistics.
3. WHEN the SuperAdmin performs a pull-to-refresh gesture, THE App SHALL re-fetch all platform statistics.

### Requirement 19: SuperAdmin — Organization Management

**User Story:** As a SuperAdmin, I want to manage organizations (create, edit, view) from the app so that I can onboard new schools and manage existing ones.

#### Acceptance Criteria

1. WHEN a SuperAdmin navigates to the Organizations screen, THE App SHALL fetch and display all organizations from the Backend_API `/api/super-admin/organizations` endpoint.
2. WHEN the SuperAdmin taps "Add Organization", THE App SHALL display a form with fields for organization name, plan type, and configuration.
3. WHEN the SuperAdmin submits a valid organization form, THE App SHALL POST to the Backend_API `/api/super-admin/organizations` endpoint and display the created organization.
4. WHEN the SuperAdmin taps on an organization, THE App SHALL display organization details including user count, person count, and plan information.
5. WHEN the SuperAdmin edits organization details, THE App SHALL PUT to the Backend_API `/api/super-admin/organizations/:id` endpoint with the updated data.

### Requirement 20: Secure Data Storage

**User Story:** As a user, I want my authentication data and sensitive information stored securely on my device so that unauthorized access to my phone does not compromise my account or organizational data.

#### Acceptance Criteria

1. THE App SHALL store JWT tokens exclusively in Secure_Storage (expo-secure-store) which uses Android Keystore-backed encryption.
2. THE App SHALL store non-sensitive cached data (attendance history, announcements) in AsyncStorage for offline access.
3. WHEN the user logs out, THE App SHALL clear all data from both Secure_Storage and AsyncStorage.
4. THE App SHALL set the `android:allowBackup` flag to `false` in the Android manifest to prevent token extraction via ADB backup.
5. IF the device is rooted, THEN THE App SHALL display a warning to the user indicating reduced security guarantees.

### Requirement 21: Network Resilience and Offline Support

**User Story:** As a user, I want the app to handle poor network conditions gracefully so that I can still view recently loaded data and queue actions for later submission.

#### Acceptance Criteria

1. WHEN the device has no network connectivity, THE App SHALL display cached data from the last successful fetch with a visual indicator showing offline status.
2. WHEN the Admin submits attendance while offline, THE App SHALL store the submission in the Offline_Queue and display a pending status indicator.
3. WHEN network connectivity is restored, THE App SHALL automatically process all items in the Offline_Queue in chronological order.
4. IF an Offline_Queue item fails after connectivity is restored, THEN THE App SHALL notify the user and allow manual retry or discard of the failed item.
5. THE App SHALL cache the last fetched data for each screen so that the user sees content immediately upon screen navigation, followed by a background refresh.

### Requirement 22: Push Notifications

**User Story:** As a Parent, I want to receive push notifications on my phone when important events occur (child marked absent, announcement published) so that I am informed in real time.

#### Acceptance Criteria

1. WHEN a Parent logs in for the first time, THE App SHALL request push notification permission and register the device push token with the Backend_API.
2. WHEN the Backend_API sends a push notification, THE App SHALL display it as a system notification with title and body.
3. WHEN the user taps on a push notification, THE App SHALL open the App and navigate to the relevant screen (attendance details, announcement, etc.).
4. WHEN the user disables push notifications in the device settings, THE App SHALL gracefully handle the absence of push capability without crashing.

### Requirement 23: App Performance and Native Experience

**User Story:** As a user, I want the app to feel fast and native so that daily workflows (especially attendance marking) are efficient and pleasant.

#### Acceptance Criteria

1. THE App SHALL render the initial dashboard screen within 2 seconds of app launch when the user has a valid cached session.
2. THE App SHALL use native navigation transitions (slide from right for push, slide down for modals) with 60fps animation.
3. THE App SHALL display skeleton loading states for all data-fetching screens rather than blank screens or full-screen spinners.
4. THE App SHALL support pull-to-refresh on all list and dashboard screens.
5. THE App SHALL persist navigation state across app backgrounding so that returning to the app resumes at the last viewed screen.

### Requirement 24: Multi-Organization Support

**User Story:** As a user who manages or is associated with multiple organizations, I want to select my organization at login so that I access the correct organizational context.

#### Acceptance Criteria

1. WHEN the user opens the login screen, THE App SHALL fetch the organization list from the Backend_API `/api/auth/organizations` endpoint and display a searchable dropdown.
2. WHEN the user types in the organization field, THE App SHALL filter the organization list using a case-insensitive search.
3. THE App SHALL store the selected organization context with the session so that subsequent API calls include the correct organization scope.

### Requirement 25: Build and Distribution

**User Story:** As the platform owner, I want to build and distribute the app as an APK and AAB for the Google Play Store so that users can install it from a trusted source.

#### Acceptance Criteria

1. THE App SHALL be built using Expo Application Services (EAS) to produce both APK (for direct distribution) and AAB (for Google Play Store) artifacts.
2. THE App SHALL target Android API level 33 (Android 13) as the minimum supported version with a target SDK of API level 34.
3. THE App SHALL include a proper app icon, splash screen, and app name ("Avento") configured in the Expo app.json.
4. THE App SHALL use a production API URL environment variable that points to `https://avento-api.onrender.com`.
5. THE App SHALL implement app versioning with semantic version numbers for Play Store update management.
