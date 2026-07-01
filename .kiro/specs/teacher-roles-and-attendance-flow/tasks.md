# Implementation Plan: Teacher Roles and Attendance Flow

## Overview

This implementation plan covers three major feature areas: (1) Teacher Roles & Permissions with granular permission system, Role Templates, and Teacher-Group assignments, (2) Sequential Attendance Marking with one-by-one student flow, session persistence, and interruption handling, and (3) Super Admin Activity Analytics with DAU/WAU/MAU/YAU tracking. The plan is organized to build foundational data models first, then backend services, then client-side implementations, with property-based tests integrated alongside implementation tasks.

## Tasks

- [x] 1. Database migrations and schema setup
  - [x] 1.1 Create migration to extend user_role ENUM with 'Teacher' value
    - Add 'Teacher' to the user_role PostgreSQL ENUM type
    - Ensure backward compatibility with existing 'Admin' and 'Stakeholder' values
    - _Requirements: 11.1_

  - [x] 1.2 Create migration for permissions table
    - Create `permissions` table with columns: id (UUID PK), user_id (FK), permission_name (VARCHAR 50), organization_id (FK), granted_at (TIMESTAMPTZ)
    - Add UNIQUE constraint on (user_id, permission_name)
    - Add INDEX on organization_id
    - _Requirements: 11.2, 2.1_

  - [x] 1.3 Create migration for role_templates and template_permissions tables
    - Create `role_templates` table with columns: id (UUID PK), name (VARCHAR 100), organization_id (FK), created_at, updated_at
    - Add UNIQUE constraint on (name, organization_id)
    - Create `template_permissions` join table with columns: template_id (FK CASCADE), permission_name (VARCHAR 50)
    - Add composite PK on (template_id, permission_name)
    - _Requirements: 11.3, 2.2_

  - [x] 1.4 Create migration for user_role_templates table
    - Create `user_role_templates` table with columns: user_id (FK CASCADE), template_id (FK RESTRICT), assigned_at (TIMESTAMPTZ)
    - Add composite PK on (user_id, template_id)
    - _Requirements: 2.3_

  - [x] 1.5 Create migration for teacher_groups table
    - Create `teacher_groups` table with columns: teacher_id (FK CASCADE), group_id (FK CASCADE), assigned_at (TIMESTAMPTZ)
    - Add composite PK on (teacher_id, group_id)
    - Add INDEX on group_id
    - _Requirements: 11.4, 4.1_

  - [x] 1.6 Create migration to add roll_number column to person_groups
    - Add nullable INTEGER column `roll_number` to person_groups
    - Add CHECK constraint: roll_number IS NULL OR (roll_number >= 1 AND roll_number <= 9999)
    - Add UNIQUE constraint on (group_id, roll_number) where roll_number IS NOT NULL
    - _Requirements: 12.1, 8.1_

  - [x] 1.7 Create migration for user_activity_events table
    - Create `user_activity_events` table with columns: id (UUID PK), user_id (FK), organization_id (FK), action_type (VARCHAR 100), endpoint (VARCHAR 255), timestamp (TIMESTAMPTZ DEFAULT now())
    - Add INDEX on (timestamp, user_id) for aggregation queries
    - Add INDEX on (organization_id, timestamp)
    - _Requirements: 13.1_

- [x] 2. Backend — Permission Service and Middleware
  - [x] 2.1 Implement Permission Service (`src/services/permissionService.ts`)
    - Implement `getEffectivePermissions(userId, organizationId)` — queries both direct permissions and template permissions, returns union
    - Implement `hasPermission(userId, organizationId, permission)` — checks effective permissions for a specific capability
    - Implement `assignDirectPermissions(userId, organizationId, permissions[])` — inserts into permissions table
    - Implement `removeDirectPermissions(userId, organizationId, permissions[])` — deletes from permissions table
    - Implement `assignRoleTemplate(userId, templateId)` — inserts into user_role_templates
    - Implement `removeRoleTemplate(userId, templateId)` — deletes from user_role_templates
    - Define the VALID_PERMISSIONS constant: mark_attendance, view_attendance_reports, create_announcements, publish_announcements, manage_holidays, approve_leave_requests, view_leave_requests, manage_students, manage_groups
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property test for effective permissions as set union
    - **Property 4: Effective permissions as set union**
    - Generate arbitrary sets of template permissions T and direct permissions D, verify computed result equals T ∪ D
    - **Validates: Requirements 2.3, 2.5, 2.6**

  - [x] 2.3 Implement requirePermission middleware (`src/middleware/requirePermission.ts`)
    - Create middleware factory that takes a permission string
    - For Admin/SuperAdmin roles: always call next() (full access)
    - For Teacher role: call permissionService.hasPermission; if false return 403 with `"Forbidden: missing permission '{permission_name}'"`
    - Handle DB errors: catch and return 500 with "Permission check failed"
    - _Requirements: 1.7, 11.5_

  - [ ]* 2.4 Write property test for permission-based navigation filtering
    - **Property 1: Permission-based navigation filtering**
    - Generate arbitrary permission sets and navigation items with required permissions, verify filter returns exactly matching items
    - **Validates: Requirements 1.5, 1.6**

- [x] 3. Backend — Teacher Management Routes
  - [x] 3.1 Implement Teacher CRUD routes (`src/routes/teachers.ts`)
    - POST `/teachers` — create teacher account with email validation (RFC 5322, max 254 chars), password (min 8 chars), organization_id scoping
    - GET `/teachers` — list all teachers in the organization
    - PUT `/teachers/:id` — update teacher details
    - DELETE `/teachers/:id` — deactivate a teacher
    - Enforce duplicate email check within organization (return 409)
    - All routes restricted to Admin role
    - _Requirements: 1.1, 1.2, 11.6_

  - [ ]* 3.2 Write property test for email and password validation
    - **Property 21: Email and password validation for Teacher creation**
    - Generate valid/invalid emails (RFC 5322 format, length ≤ 254) and passwords (length ≥ 8)
    - **Validates: Requirements 1.1**

  - [x] 3.3 Extend auth service to issue Teacher JWT
    - Modify login handler to support Teacher role authentication
    - Ensure JWT payload contains user_id, organization_id, and role "Teacher"
    - Ensure invalid credentials return generic error without revealing which field is wrong
    - _Requirements: 1.3, 1.4_

  - [ ]* 3.4 Write property test for Teacher JWT structure
    - **Property 20: Teacher JWT structure**
    - Verify all Teacher JWTs contain user_id, organization_id, and role="Teacher"
    - **Validates: Requirements 1.3**

- [x] 4. Backend — Role Template Routes
  - [x] 4.1 Implement Role Template CRUD routes (`src/routes/roleTemplates.ts`)
    - POST `/role-templates` — create with name (1-100 chars, unique per org) and permissions array
    - GET `/role-templates` — list all templates for the organization
    - PUT `/role-templates/:id` — update template name and/or permissions (immediate effect per Req 2.4)
    - DELETE `/role-templates/:id` — delete only if no teachers are assigned (return 409 if in use)
    - Validate duplicate name returns 409
    - All routes restricted to Admin role
    - _Requirements: 2.2, 2.4, 2.7, 2.8, 2.10_

  - [ ]* 4.2 Write property test for role template name validation
    - **Property 5: Role template name validation**
    - Generate strings of length 1-100 (should succeed) and length 0 or >100 (should fail)
    - **Validates: Requirements 2.2**

- [x] 5. Backend — Teacher-Group Assignment and Leave Approval
  - [x] 5.1 Implement Teacher Group Service and routes (`src/services/teacherGroupService.ts`, `src/routes/teachers.ts`)
    - PUT `/teachers/:id/groups` — assign groups to teacher (validate groups belong to same org)
    - GET `/teachers/:id/groups` — get assigned groups
    - Implement `assignGroups`, `removeGroup`, `getAssignedGroups`, `isAssignedToGroup` methods
    - Enforce org-scoping: teacher can only be assigned to groups within their organization
    - _Requirements: 4.1, 4.2, 11.4_

  - [x] 5.2 Extend leave request routes for Teacher-scoped approval
    - Modify leave approval/rejection endpoints to accept Teacher with approve_leave_requests permission
    - Validate the leave request's person is in one of the Teacher's assigned groups (return 403 if not)
    - Record reviewer user_id, role, and timestamp on the leave request
    - Handle already-resolved requests (return 409 with existing decision)
    - First-come-first-served between Admin and Teacher
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.3 Write property test for teacher-scoped leave approval access
    - **Property 6: Teacher-scoped leave approval access**
    - Generate teachers with assigned groups and leave requests, verify approval succeeds for persons in assigned groups and fails for others
    - **Validates: Requirements 3.1, 3.4**

- [x] 6. Checkpoint — Backend roles and permissions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend — Sequential Attendance and Roll Number
  - [x] 7.1 Implement GET `/attendance/group/:groupId/members` endpoint
    - Return group members sorted by roll_number ascending (nulls last, alphabetical by name)
    - Return all members in single response for groups up to 200 members
    - Include person_id, name, roll_number, photo_url for each member
    - Authorize: Admin (full access) or Teacher with mark_attendance + assigned to group
    - _Requirements: 12.2, 8.2, 8.3_

  - [x] 7.2 Implement roll_number management endpoint
    - PUT `/groups/:groupId/members/:personId/roll-number` — assign/update roll number
    - Validate range 1-9999, reject duplicates within group (return 409)
    - Admin only
    - _Requirements: 8.1, 8.4, 8.5, 12.1_

  - [x] 7.3 Extend existing POST `/attendance/bulk` authorization for Teachers
    - Add requirePermission('mark_attendance') middleware
    - Validate Teacher is assigned to the target group
    - Preserve existing behavior for Admin users
    - _Requirements: 5.6, 7.3_

  - [ ]* 7.4 Write property test for sequential attendance ordering
    - **Property 9: Sequential attendance ordering**
    - Generate groups with mixed roll_number (some null, some assigned), verify ordering: non-null ascending first, then null sorted alphabetically by name
    - **Validates: Requirements 5.1, 5.2, 8.2, 8.3**

  - [ ]* 7.5 Write property test for roll number validation
    - **Property 15: Roll number validation**
    - Generate integers in/out of 1-9999 range and duplicates, verify accept/reject behavior
    - **Validates: Requirements 8.1**

- [x] 8. Backend — Activity Tracking and Analytics
  - [x] 8.1 Implement activity tracker middleware (`src/middleware/activityTracker.ts`)
    - Record Activity_Event asynchronously on each authenticated request
    - Exclude health-check routes (e.g., `/health`, `/ping`) and static asset routes
    - Exclude requests from service accounts / background processes
    - Use fire-and-forget pattern: catch errors silently, log to stderr
    - _Requirements: 9.1, 9.2, 13.2_

  - [x] 8.2 Implement Activity Event Service and aggregation queries (`src/services/activityEventService.ts`)
    - DAU: COUNT(DISTINCT user_id) WHERE timestamp in given UTC calendar day
    - WAU: COUNT(DISTINCT user_id) WHERE timestamp in 7-day window ending on given date (inclusive)
    - MAU: COUNT(DISTINCT user_id) WHERE timestamp in given UTC calendar month
    - YAU: COUNT(DISTINCT user_id) WHERE timestamp in given UTC calendar year
    - Support optional organization_id filter
    - Return 0 when no events in window
    - Ensure queries perform within 5 seconds for up to 10M events (use appropriate indexes)
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 13.3_

  - [x] 8.3 Implement SuperAdmin analytics routes (`src/routes/superAdmin.ts`)
    - GET `/super-admin/analytics` — return DAU/WAU/MAU/YAU for current period, support custom date range and org filter
    - GET `/super-admin/analytics/trend` — return 30-day DAU trend (one data point per day)
    - Validate date range: max 365 days, end ≥ start (return 400 on invalid)
    - Restrict to SuperAdmin role only
    - _Requirements: 10.3, 10.4, 10.5_

  - [x] 8.4 Implement data retention scheduled job
    - Create a cron job/scheduled task to archive or delete Activity_Events older than 13 months
    - Run once per day
    - _Requirements: 13.4_

  - [ ]* 8.5 Write property test for activity metric aggregation
    - **Property 16: Activity metric aggregation (DAU/WAU/MAU/YAU)**
    - Generate sets of activity events with various timestamps and user_ids, verify distinct count matches for each window type
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.6, 9.8**

  - [ ]* 8.6 Write property test for activity metric organization filtering
    - **Property 17: Activity metric organization filtering**
    - Generate events across multiple organizations, verify filtered count vs platform-wide total
    - **Validates: Requirements 9.7**

  - [ ]* 8.7 Write property test for analytics date range validation
    - **Property 19: Analytics date range validation**
    - Generate valid/invalid date ranges (span > 365 days, end < start), verify accept/reject
    - **Validates: Requirements 10.4, 10.5**

  - [ ]* 8.8 Write property test for activity event exclusion
    - **Property 18: Activity event exclusion for non-user requests**
    - Generate requests matching/not-matching exclusion paths, verify no event recorded for excluded paths
    - **Validates: Requirements 9.2**

- [x] 9. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Admin Panel — Teacher Management UI
  - [x] 10.1 Implement TeacherListPage component
    - Display list of teachers in the organization with search/filter
    - Show teacher name, email, assigned role template, and number of assigned groups
    - Add "Create Teacher" button linking to form
    - _Requirements: 11.6_

  - [x] 10.2 Implement TeacherFormPage component (create/edit)
    - Form fields: email, password (create only), name
    - Email validation (RFC 5322, max 254 chars), password min 8 chars
    - Display error on duplicate email within org
    - _Requirements: 1.1, 1.2, 11.6_

  - [x] 10.3 Implement TeacherPermissionsPage component
    - UI for assigning a Role_Template to a teacher (dropdown)
    - UI for assigning individual permissions (checkboxes for each of the 9 permissions)
    - Show effective permissions as the union of template + direct
    - _Requirements: 2.9, 11.6_

  - [x] 10.4 Implement TeacherGroupsPage component
    - UI for assigning/removing groups to/from a teacher
    - Multi-select of available groups within the organization
    - Display currently assigned groups
    - _Requirements: 4.3, 11.6_

- [x] 11. Admin Panel — Role Template Management UI
  - [x] 11.1 Implement RoleTemplateListPage component
    - List all role templates for the organization
    - Show template name and number of assigned teachers
    - Delete button (disabled or shows error if template is in use)
    - _Requirements: 2.7_

  - [x] 11.2 Implement RoleTemplateFormPage component (create/edit)
    - Form with name field (1-100 chars)
    - Permission checkboxes (all 9 permissions)
    - Display error on duplicate name
    - _Requirements: 2.7, 2.10_

- [x] 12. Admin Panel — Sequential Attendance Components
  - [x] 12.1 Implement AttendanceModeSelector component
    - Modal/dialog presenting choice between Sequential and Bulk mode
    - Display before navigating to the marking screen
    - _Requirements: 7.1_

  - [x] 12.2 Implement SequentialAttendanceScreen component
    - Single-student card showing name, roll number, profile photo
    - Status buttons: Present, Absent, Late
    - Previous/Next navigation buttons
    - Progress indicator: "X of Y"
    - Auto-advance to next student after marking (within 300ms)
    - Handle empty group: display "no students available" message
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.7, 12.3_

  - [x] 12.3 Implement AttendanceSummaryScreen component
    - Display counts: Present, Absent, Late
    - Confirm button to submit via existing bulk endpoint
    - On submit failure: display error, retain statuses, allow retry
    - _Requirements: 5.3, 5.6, 5.8_

  - [x] 12.4 Implement session persistence in Admin Panel (localStorage)
    - Save session state after each mark (auto-save)
    - Storage key format: `attendance_session_{groupId}_{date}`
    - Store: group_id, date, members array with statuses, current_position, saved_at, member_ids_hash
    - Expire sessions older than 24 hours
    - On exit: show confirmation prompt to save or discard
    - On resume: check if session < 24h old, offer to resume
    - Detect membership changes via member_ids_hash comparison
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.5_

  - [x] 12.5 Implement RollNumberEditor component
    - Admin UI for assigning/editing roll numbers per group
    - Input validation: 1-9999, unique within group
    - Display error on duplicate assignment
    - _Requirements: 8.4, 8.5_

  - [x] 12.6 Implement Teacher-specific navigation filtering in Admin Panel
    - Show/hide navigation items based on Teacher's effective permissions
    - Display only assigned groups for attendance/leave operations
    - Show empty state when no groups assigned
    - _Requirements: 1.5, 4.4, 4.5_

- [x] 13. Checkpoint — Admin Panel complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Mobile App — Teacher Navigation and Permissions
  - [x] 14.1 Implement TeacherTabNavigator
    - Create tab navigator for Teacher role
    - Show/hide tabs based on granted permissions
    - Extend existing roleGuard pattern for Teacher permission checks
    - _Requirements: 1.6, 11.7_

  - [x] 14.2 Implement permission-gated screen visibility
    - Each screen checks required permission before rendering
    - Display "permission denied" screen with specific permission name if access denied
    - Show only assigned groups for attendance/leave screens
    - Show empty state when no groups assigned
    - _Requirements: 1.6, 4.4, 4.5_

- [x] 15. Mobile App — Sequential Attendance Flow
  - [x] 15.1 Implement AttendanceModeScreen
    - Present choice between Sequential and Bulk mode
    - Navigate to appropriate screen based on selection
    - _Requirements: 7.1_

  - [x] 15.2 Implement SequentialAttendanceScreen
    - Single-student card: name, roll number, profile photo
    - Swipe or button navigation (Previous/Next)
    - Status selector: Present, Absent, Late
    - Progress indicator: "X of Y"
    - Auto-advance after marking (within 300ms)
    - Handle empty group: show "no students available"
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.7, 12.3_

  - [x] 15.3 Implement AttendanceSummaryScreen (Mobile)
    - Display counts: Present, Absent, Late
    - Confirm button to submit
    - On failure: retain statuses, show error, offer retry
    - _Requirements: 5.3, 5.6, 5.8_

  - [x] 15.4 Implement useAttendanceSession hook (AsyncStorage)
    - Auto-save session after each mark
    - Storage key: `attendance_session_{groupId}_{date}`
    - Store full session state with member_ids_hash
    - 24-hour expiration logic
    - Exit confirmation prompt
    - Resume detection and membership change detection
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.4_

  - [ ]* 15.5 Write property test for attendance session summary counts
    - **Property 10: Attendance session summary counts**
    - Generate lists of marked statuses, verify Present + Absent + Late counts match individual counts and sum to total
    - **Validates: Requirements 5.3**

  - [ ]* 15.6 Write property test for session local persistence round-trip
    - **Property 12: Attendance session local persistence round-trip**
    - Generate valid session states, save to storage, read back, verify equality
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 15.7 Write property test for session expiration by age
    - **Property 13: Session expiration by age**
    - Generate sessions with various saved_at timestamps, verify < 24h resumes, ≥ 24h discards
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 15.8 Write property test for session membership change detection
    - **Property 14: Session membership change detection**
    - Generate sessions with original and modified member sets, verify change detection via hash comparison
    - **Validates: Requirements 6.7**

- [x] 16. Mobile App — SuperAdmin Analytics Screen
  - [x] 16.1 Implement AnalyticsScreen in SuperAdminTabNavigator
    - Display DAU, WAU, MAU, YAU metric cards
    - Fetch from `/super-admin/analytics` endpoint
    - Show error state with retry option if data unavailable
    - _Requirements: 10.1, 10.6_

- [x] 17. Admin Panel — SuperAdmin Analytics Widget
  - [x] 17.1 Implement AnalyticsDashboardWidget
    - Display DAU/WAU/MAU/YAU metric cards on SuperAdmin dashboard
    - 30-day DAU trend line chart
    - Custom date range selector (max 365 days)
    - Organization filter dropdown
    - Error state with retry option
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 13.5_

- [x] 18. Integration wiring and final validation
  - [x] 18.1 Register all new middleware in Express app
    - Add activityTracker middleware to the middleware chain (after auth, before route handlers)
    - Register requirePermission in relevant route files
    - Wire up new routes: `/teachers`, `/role-templates`, `/attendance/group/:groupId/members`, extended `/super-admin/analytics`
    - _Requirements: 11.5, 13.2_

  - [x] 18.2 Update Admin Panel navigation and routing
    - Add Teacher Management section to admin navigation (Admin only)
    - Add Role Templates section to admin navigation (Admin only)
    - Add AttendanceModeSelector to attendance flow entry point
    - Add analytics widget to SuperAdmin dashboard
    - Implement Teacher-role navigation filtering
    - _Requirements: 11.6, 11.7_

  - [x] 18.3 Update Mobile App navigation and routing
    - Register TeacherTabNavigator in RootNavigator
    - Add AttendanceModeScreen to attendance flow
    - Add AnalyticsScreen to SuperAdminTabNavigator
    - Update roleGuard to support Teacher permission checks
    - _Requirements: 11.7_

  - [ ]* 18.4 Write integration tests for end-to-end flows
    - Teacher login → permission-gated API access
    - Leave request approval flow (Admin and Teacher)
    - Sequential attendance full cycle: select group → mark all → submit → verify DB records
    - Activity event recording on authenticated requests
    - SuperAdmin analytics dashboard data flow
    - _Requirements: All_

- [x] 19. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses Node.js/Express with Knex and PostgreSQL
- The Admin Panel uses React/Vite
- The Mobile App uses React Native/Expo
- Property-based tests use fast-check with minimum 100 iterations
- The existing `POST /attendance/bulk` endpoint is reused for both sequential and bulk mode submissions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"] },
    { "id": 1, "tasks": ["2.1", "3.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.1", "5.1", "8.2"] },
    { "id": 3, "tasks": ["2.4", "3.4", "4.2", "5.2", "7.1", "7.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["5.3", "7.3", "7.4", "7.5", "8.5", "8.6", "8.7", "8.8"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4", "11.1", "11.2", "14.1"] },
    { "id": 6, "tasks": ["12.1", "12.2", "12.5", "12.6", "14.2", "15.1", "16.1", "17.1"] },
    { "id": 7, "tasks": ["12.3", "12.4", "15.2", "15.4"] },
    { "id": 8, "tasks": ["15.3", "15.5", "15.6", "15.7", "15.8"] },
    { "id": 9, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 10, "tasks": ["18.4"] }
  ]
}
```
