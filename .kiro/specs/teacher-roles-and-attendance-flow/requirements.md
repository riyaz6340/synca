# Requirements Document

## Introduction

This document defines requirements for extending the Avento People Presence Platform with three major feature areas: (1) a granular teacher/staff roles and permissions system allowing multiple users beyond the single Admin to access organization-level features, (2) a sequential attendance marking flow where students are presented one-by-one by roll number for Present/Absent/Late marking, and (3) Super Admin analytics for tracking Daily, Weekly, Monthly, and Yearly Active Users across the platform. A gap analysis against the current system is also captured to guide implementation priority.

## Glossary

- **Platform**: The Avento People Presence multi-tenant SaaS application (backend, web frontend, and mobile app collectively)
- **Backend_API**: The Node.js/Express REST API server backed by PostgreSQL
- **Admin_Panel**: The React/Vite web frontend at `frontend/` used by Admin and Teacher users
- **Mobile_App**: The React Native/Expo mobile application at `avento-mobile/`
- **Organization**: A tenant account (e.g., a school) with isolated data and users
- **Admin**: An organization-level user with full access to all features within their organization
- **Teacher**: A new user type within an organization with a configurable subset of Admin permissions
- **SuperAdmin**: The platform owner user who manages all organizations
- **Permission**: A granular capability that can be granted to a Teacher (e.g., mark_attendance, create_announcements)
- **Role_Template**: A named bundle of Permissions that an Admin can assign to one or more Teachers
- **Sequential_Attendance_Mode**: An attendance marking flow where students appear one-by-one in roll number order
- **Bulk_Attendance_Mode**: The existing attendance marking flow where all students in a group are shown simultaneously
- **Group**: A class or section within an organization containing members (students/persons)
- **Person**: A student or individual whose attendance is tracked
- **Roll_Number**: A serial number assigned to a Person within a Group, determining display order
- **Attendance_Session**: A single instance of marking attendance for a Group on a given date, tracking progress through the member list
- **DAU**: Daily Active Users — unique users who performed at least one authenticated action on a given calendar day
- **WAU**: Weekly Active Users — unique users who performed at least one authenticated action in a given 7-day period
- **MAU**: Monthly Active Users — unique users who performed at least one authenticated action in a given calendar month
- **YAU**: Yearly Active Users — unique users who performed at least one authenticated action in a given calendar year
- **Activity_Event**: A record of an authenticated user action (login, API call, or screen view) used for computing active user metrics

## Requirements

### Requirement 1: Teacher User Creation and Authentication

**User Story:** As an Admin, I want to create teacher accounts that can log in to the Admin Panel and Mobile App, so that teachers can help manage school operations without needing full Admin access.

#### Acceptance Criteria

1. WHEN an Admin creates a Teacher account, THE Backend_API SHALL store the Teacher with a valid email address (maximum 254 characters, RFC 5322 format), a password of at least 8 characters, organization_id, and role "Teacher"
2. IF an Admin attempts to create a Teacher account with an email that already exists within the same Organization, THEN THE Backend_API SHALL reject the request and return an error message indicating the email is already in use
3. WHEN a Teacher logs in with valid credentials, THE Backend_API SHALL issue a JWT containing user_id, organization_id, and role "Teacher"
4. IF a Teacher attempts to log in with an incorrect password or non-existent email, THEN THE Backend_API SHALL reject the request and return an error message indicating invalid credentials without revealing which field is incorrect
5. WHEN a Teacher authenticates, THE Admin_Panel SHALL display only the navigation items corresponding to the Teacher's granted Permissions
6. WHEN a Teacher authenticates, THE Mobile_App SHALL display only the screens corresponding to the Teacher's granted Permissions
7. IF a Teacher attempts to access a feature for which they lack Permission, THEN THE Backend_API SHALL return HTTP 403 with an error message indicating the specific Permission that is missing
8. THE Backend_API SHALL enforce tenant isolation so that a Teacher can only access data within their own Organization

### Requirement 2: Permission Model and Role Templates

**User Story:** As an Admin, I want to define granular permissions and group them into role templates, so that I can efficiently assign appropriate access levels to different teachers.

#### Acceptance Criteria

1. THE Backend_API SHALL support the following granular Permissions: mark_attendance, view_attendance_reports, create_announcements, publish_announcements, manage_holidays, approve_leave_requests, view_leave_requests, manage_students, manage_groups
2. WHEN an Admin creates a Role_Template, THE Backend_API SHALL store a named template (name between 1 and 100 characters, unique per Organization) with a set of one or more Permissions scoped to the Organization
3. WHEN an Admin assigns a Role_Template to a Teacher, THE Backend_API SHALL grant all Permissions in that template to the Teacher
4. WHEN an Admin modifies a Role_Template's Permissions, THE Backend_API SHALL immediately update the effective Permissions for all Teachers assigned to that template without requiring those Teachers to re-authenticate
5. WHEN an Admin assigns individual Permissions directly to a Teacher (without a template), THE Backend_API SHALL store and enforce those Permissions
6. IF a Teacher has both a Role_Template assignment and individually assigned Permissions, THEN THE Backend_API SHALL compute the effective Permissions as the union of all template Permissions and all individually assigned Permissions
7. THE Admin_Panel SHALL provide a user interface for creating, editing, and deleting Role_Templates
8. IF an Admin attempts to delete a Role_Template that is currently assigned to one or more Teachers, THEN THE Backend_API SHALL reject the deletion and return an error message indicating the template is in use
9. THE Admin_Panel SHALL provide a user interface for assigning Role_Templates or individual Permissions to Teachers
10. IF an Admin attempts to create a Role_Template with a name that already exists within the same Organization, THEN THE Backend_API SHALL reject the request and return an error message indicating the name is already taken

### Requirement 3: Teacher-Scoped Leave Request Approval

**User Story:** As a school administrator, I want class teachers to be able to approve leave requests for their class students, so that leave approvals are handled faster without bottlenecking on the Admin.

#### Acceptance Criteria

1. WHEN a Teacher has the approve_leave_requests Permission, THE Backend_API SHALL allow the Teacher to approve or reject leave requests that are in "pending" status for Persons in Groups assigned to the Teacher
2. IF both Admin and Teacher have the approve_leave_requests Permission for a leave request, THEN THE Backend_API SHALL accept approval or rejection from whichever party acts first and transition the request to the corresponding terminal status
3. WHEN a Teacher or Admin approves or rejects a leave request, THE Backend_API SHALL record the reviewer identity (user_id and role) and the timestamp of the decision on the leave request
4. IF a Teacher attempts to approve a leave request for a Person not in any of the Teacher's assigned Groups, THEN THE Backend_API SHALL return HTTP 403 with an error message indicating insufficient scope
5. IF a Teacher or Admin attempts to approve or reject a leave request that is no longer in "pending" status, THEN THE Backend_API SHALL return an error response indicating the request has already been resolved and include the existing decision

### Requirement 4: Teacher-Group Assignment

**User Story:** As an Admin, I want to assign teachers to specific classes (groups), so that teachers can manage attendance and leave requests only for their assigned students.

#### Acceptance Criteria

1. WHEN an Admin assigns a Teacher to a Group, THE Backend_API SHALL store the association between the Teacher user and the Group
2. WHEN an Admin removes a Teacher-Group assignment, THE Backend_API SHALL delete the association and THE Teacher SHALL no longer have access to that Group's data for attendance or leave operations
3. THE Admin_Panel SHALL provide a user interface for assigning and removing one or more Groups to/from a Teacher
4. WHEN a Teacher has the mark_attendance Permission, THE Mobile_App and Admin_Panel SHALL display only the Groups assigned to that Teacher for attendance marking
5. IF a Teacher has no Groups assigned, THEN THE Mobile_App and Admin_Panel SHALL display an empty state indicating no groups are available and no attendance or leave operations SHALL be accessible
6. WHEN an Admin marks attendance, THE Admin_Panel and Mobile_App SHALL display all Groups in the Organization (existing behavior preserved)

### Requirement 5: Sequential Attendance Marking Flow

**User Story:** As a Teacher or Admin, I want to mark attendance by having students appear one-by-one in roll number order, so that I can quickly go through the class list systematically.

#### Acceptance Criteria

1. WHEN a user selects Sequential_Attendance_Mode for a Group, THE Mobile_App and Admin_Panel SHALL display the first Person in roll number order with their name, roll number, and profile photo (if available)
2. WHEN the user marks a Person as Present, Absent, or Late, THE Mobile_App and Admin_Panel SHALL display the next Person in roll number order within 300 milliseconds
3. WHEN all Persons in the Group have been marked, THE Mobile_App and Admin_Panel SHALL display a summary of the Attendance_Session showing the count of Persons marked as Present, the count marked as Absent, and the count marked as Late
4. WHILE an Attendance_Session is in progress, THE Mobile_App and Admin_Panel SHALL display a progress indicator showing current position out of total students (e.g., "5 of 32")
5. WHILE an Attendance_Session is in progress and at least one Person has been marked, THE Mobile_App and Admin_Panel SHALL allow the user to navigate backward to any previously marked Person in the list and change their status
6. WHEN the user confirms the attendance summary, THE Backend_API SHALL persist all attendance records for the Group and date as a single bulk operation
7. IF a user selects Sequential_Attendance_Mode for a Group that contains zero Persons, THEN THE Mobile_App and Admin_Panel SHALL display a message indicating no students are available and SHALL NOT create an Attendance_Session
8. IF the bulk persist operation fails after the user confirms the attendance summary, THEN THE Mobile_App and Admin_Panel SHALL display an error message indicating the submission failed, retain all marked statuses, and allow the user to retry submission

### Requirement 6: Sequential Attendance — Interruption Handling

**User Story:** As a Teacher, I want my partial attendance marking to be preserved if I accidentally close the app or navigate away, so that I don't lose work.

#### Acceptance Criteria

1. WHEN a user attempts to exit or navigate away from an in-progress Attendance_Session, THE Mobile_App and Admin_Panel SHALL display a confirmation prompt asking whether to save progress or discard
2. WHEN the user confirms saving progress during an interruption, THE Mobile_App and Admin_Panel SHALL persist the partial session data locally on the device, including each Person's marked status and the current position in the sequence
3. WHILE an Attendance_Session is in progress, THE Mobile_App and Admin_Panel SHALL auto-save the partial session locally after each attendance mark so that data is preserved if the app is force-closed or crashes without user interaction
4. WHEN the user returns to the Sequential_Attendance_Mode for the same Group and date with a saved partial session that is less than 24 hours old, THE Mobile_App and Admin_Panel SHALL offer to resume from the last marked position
5. IF a saved partial session is older than 24 hours, THEN THE Mobile_App and Admin_Panel SHALL discard the stale session data and start a new Attendance_Session
6. IF the user discards an interrupted session, THEN THE Mobile_App and Admin_Panel SHALL clear the partial session data and return to the Group selection screen
7. IF the Group membership has changed since the partial session was saved (students added or removed), THEN THE Mobile_App and Admin_Panel SHALL notify the user of the change and offer to resume with updated membership or start a new session

### Requirement 7: Attendance Mode Selection

**User Story:** As a Teacher or Admin, I want to choose between sequential and bulk attendance marking modes, so that I can use whichever method suits my situation.

#### Acceptance Criteria

1. WHEN a user initiates attendance marking for a Group, THE Mobile_App and Admin_Panel SHALL present a choice between Sequential_Attendance_Mode and Bulk_Attendance_Mode before proceeding to the marking screen
2. THE Bulk_Attendance_Mode SHALL display all Persons in the selected Group simultaneously, each with a status toggle allowing selection of Present, Absent, or Late, and submit all records as a single bulk operation (preserving existing behavior)
3. THE Backend_API SHALL accept attendance submissions from both modes using the same bulk attendance endpoint without differentiation

### Requirement 8: Roll Number Ordering for Sequential Mode

**User Story:** As an Admin, I want students to appear in roll number order during sequential attendance, so that it matches the physical attendance register.

#### Acceptance Criteria

1. THE Backend_API SHALL support a roll_number field on the Person-Group relationship (person_groups table) as a nullable integer that is unique within each Group, with valid values ranging from 1 to 9999
2. WHEN Sequential_Attendance_Mode is initiated, THE Mobile_App and Admin_Panel SHALL sort Persons by roll_number in ascending numeric order
3. IF a Person does not have a roll_number assigned, THEN THE Mobile_App and Admin_Panel SHALL place that Person at the end of the list sorted alphabetically by name
4. THE Admin_Panel SHALL provide a user interface for assigning and editing roll numbers for Persons within a Group
5. IF an Admin attempts to assign a roll_number that is already in use by another Person in the same Group, THEN THE Admin_Panel SHALL display an error indicating the duplicate and prevent the assignment

### Requirement 9: Super Admin User Activity Tracking

**User Story:** As a Super Admin, I want to track how many unique users actively use the platform daily, weekly, monthly, and yearly, so that I can understand user engagement and platform health.

#### Acceptance Criteria

1. WHEN an authenticated user performs any API action, THE Backend_API SHALL record an Activity_Event with user_id, organization_id, timestamp (UTC, second precision), and action type
2. THE Backend_API SHALL NOT record Activity_Events for actions performed by service accounts, automated background processes, or health-check calls
3. WHEN a Super Admin requests the DAU metric for a specified date, THE Backend_API SHALL return the count of distinct user_ids with at least one Activity_Event on that UTC calendar day (00:00:00 to 23:59:59 UTC)
4. WHEN a Super Admin requests the WAU metric for a specified date, THE Backend_API SHALL return the count of distinct user_ids with at least one Activity_Event in the 7-day window ending on that date (inclusive)
5. WHEN a Super Admin requests the MAU metric for a specified month, THE Backend_API SHALL return the count of distinct user_ids with at least one Activity_Event in the queried UTC calendar month
6. WHEN a Super Admin requests the YAU metric for a specified year, THE Backend_API SHALL return the count of distinct user_ids with at least one Activity_Event in the queried UTC calendar year
7. WHEN a Super Admin requests any activity metric, THE Backend_API SHALL support filtering results by a specific organization_id or returning platform-wide totals when no organization filter is provided
8. IF a Super Admin requests an activity metric for a period containing no Activity_Events, THEN THE Backend_API SHALL return a count of zero for that metric

### Requirement 10: Super Admin Analytics Dashboard

**User Story:** As a Super Admin, I want to see DAU, WAU, MAU, and YAU metrics on my dashboard, so that I can monitor platform engagement at a glance.

#### Acceptance Criteria

1. WHEN the Super Admin opens the platform dashboard, THE Admin_Panel (SuperAdmin view) and Mobile_App SHALL display the DAU count for the current calendar day, WAU count for the trailing 7-day window ending today, MAU count for the current calendar month, and YAU count for the current calendar year
2. WHEN the Super Admin opens the platform dashboard, THE Admin_Panel SHALL display a line chart showing one DAU data point per day for the past 30 calendar days
3. THE Backend_API SHALL provide an endpoint returning DAU, WAU, MAU, and YAU metrics accessible only to SuperAdmin users, responding within 5 seconds
4. WHEN the SuperAdmin requests analytics with a custom date range, THE Backend_API SHALL return DAU/WAU/MAU/YAU computed for that range, limited to a maximum span of 365 days
5. IF the SuperAdmin requests analytics with a date range exceeding 365 days or with an end date before the start date, THEN THE Backend_API SHALL return an error indicating the invalid range without processing the request
6. IF analytics data is unavailable or the computation times out, THEN THE Admin_Panel and Mobile_App SHALL display an error state indicating that metrics could not be loaded and offer a retry option

### Requirement 11: Gap Analysis — Role System Extension

**User Story:** As a development team, we want to understand what changes are needed to the existing system to support teacher roles, so that we can plan implementation accurately.

#### Acceptance Criteria

1. THE Backend_API SHALL extend the user_role PostgreSQL ENUM to include "Teacher" in addition to existing "Admin" and "Stakeholder" values
2. THE Backend_API SHALL introduce a permissions table storing granular permission grants per user, with columns: id, user_id, permission_name, organization_id, and granted_at timestamp
3. THE Backend_API SHALL introduce a role_templates table storing named bundles of permissions per organization, with columns: id, name, organization_id, and an associated template_permissions join table linking template_id to permission_name
4. THE Backend_API SHALL introduce a teacher_groups table (or extend person_groups) to associate Teacher users with Groups, enforcing that a Teacher can only be assigned to Groups within their own Organization
5. THE Backend_API SHALL modify the authorize middleware to check granular permissions for Teacher users instead of only checking role membership; IF the permissions lookup fails due to a database error, THEN THE Backend_API SHALL deny access and return HTTP 500 with an error indicating a permission check failure
6. THE Admin_Panel SHALL add navigation and screens for teacher management, including: a list view of all Teachers in the Organization, a create/edit form for Teacher accounts, a permission assignment interface, and a group assignment interface
7. THE Mobile_App SHALL add a Teacher navigation flow where each screen and navigation item is shown or hidden based on the Teacher's granted Permissions, matching the same permission checks enforced by the Backend_API

### Requirement 12: Gap Analysis — Sequential Attendance Infrastructure

**User Story:** As a development team, we want to understand what new infrastructure is needed to support sequential attendance, so that we can plan implementation accurately.

#### Acceptance Criteria

1. THE Backend_API SHALL support a roll_number column on the person_groups join table (nullable integer, unique per group); IF a duplicate roll_number is submitted for the same group, THEN THE Backend_API SHALL return an error indicating the conflict
2. THE Backend_API SHALL provide an endpoint to retrieve Group members sorted by roll_number in ascending order for the sequential flow, returning all members in a single response (no pagination) for groups up to 200 members
3. THE Mobile_App and Admin_Panel SHALL implement a new Sequential Attendance screen component displaying a single-student card (showing name, roll number, and profile photo), Previous/Next navigation controls, a status selector (Present/Absent/Late), and a progress indicator showing current position out of total
4. THE Mobile_App SHALL implement local storage for partial Attendance_Session state using AsyncStorage or equivalent, storing the group_id, date, array of marked statuses, and current position, with an automatic expiration after 24 hours
5. THE Admin_Panel SHALL implement local storage for partial Attendance_Session state using browser localStorage or equivalent, storing the group_id, date, array of marked statuses, and current position, with an automatic expiration after 24 hours

### Requirement 13: Gap Analysis — Activity Tracking Infrastructure

**User Story:** As a development team, we want to understand what new infrastructure is needed to support user activity analytics, so that we can plan implementation accurately.

#### Acceptance Criteria

1. THE Backend_API SHALL introduce a user_activity_events table with columns: id (UUID primary key), user_id (foreign key), organization_id (foreign key), action_type (varchar, max 100 characters), endpoint (varchar, max 255 characters), timestamp (timestamptz), with an index on (timestamp, user_id) for aggregation queries
2. THE Backend_API SHALL implement an Express middleware that records Activity_Events asynchronously on each authenticated request (excluding health-check and static asset routes), such that event recording failures do not block or fail the original API response
3. THE Backend_API SHALL implement aggregation queries or materialized views for DAU/WAU/MAU/YAU computation that return results within 5 seconds for datasets up to 10 million Activity_Events
4. THE Backend_API SHALL implement a data retention policy to archive or delete Activity_Events older than 13 months, executed as a scheduled job running once per day
5. THE Admin_Panel (SuperAdmin section) SHALL add an analytics widget to the existing platform dashboard screen displaying the four metric counts (DAU, WAU, MAU, YAU) and the 30-day DAU trend line chart as specified in Requirement 10
