# Requirements Document

## Introduction

This feature extends the existing push notification deep-linking infrastructure to support leave-related notification types (`leave_approved`, `leave_rejected`, `admin_leave_pending`) with role-aware routing. The system reads the authenticated user's role from the auth store and routes the same notification type to the correct tab navigator (Parent, Admin, SuperAdmin, or Teacher). The backend includes structured IDs in the notification data payload so the mobile app can navigate directly to the relevant leave screen.

## Glossary

- **Push_Service**: The `pushNotifications` module in `src/services/pushNotifications.ts` responsible for resolving notification payloads to navigation targets
- **Navigation_Ref**: The `navigationRef` module in `src/navigation/navigationRef.ts` responsible for dispatching navigation actions to the correct nested route
- **Auth_Store**: The Zustand store in `src/stores/auth.ts` that holds the authenticated user's role and session state
- **Backend_API**: The server-side system that sends push notifications with structured data payloads to devices
- **Notification_Payload**: The `data` field of a push notification containing `type` and associated entity IDs
- **Navigation_Target**: A `{ screen, params }` object representing the resolved destination screen and its parameters
- **Role_Router**: The logic within Navigation_Ref that maps a Navigation_Target to the correct role-based tab navigator path
- **Parent_Tabs**: The tab navigator for users with the Stakeholder role
- **Admin_Tabs**: The tab navigator for users with the Admin role
- **SuperAdmin_Tabs**: The tab navigator for users with the SuperAdmin role
- **Teacher_Tabs**: The tab navigator for users with the Teacher role

## Requirements

### Requirement 1: Leave Approved Notification Deep-Link

**User Story:** As a parent (Stakeholder), I want tapping a "leave approved" notification to open my leave list screen, so that I can immediately see the status of my child's approved leave request.

#### Acceptance Criteria

1. WHEN the Push_Service receives a Notification_Payload with `type` equal to `leave_approved`, THE Push_Service SHALL resolve a Navigation_Target with `screen` set to `LeaveList` and `params` containing `leaveId` extracted from the payload.
2. WHEN the Push_Service receives a Notification_Payload with `type` equal to `leave_approved` and the payload contains a `person_id` field, THE Push_Service SHALL include `personId` in the Navigation_Target params.
3. IF the Notification_Payload with `type` equal to `leave_approved` is missing the `leaveId` or `leave_id` field, THEN THE Push_Service SHALL return null instead of a Navigation_Target.

### Requirement 2: Leave Rejected Notification Deep-Link

**User Story:** As a parent (Stakeholder), I want tapping a "leave rejected" notification to open my leave list screen, so that I can review which request was rejected and take action.

#### Acceptance Criteria

1. WHEN the Push_Service receives a Notification_Payload with `type` equal to `leave_rejected`, THE Push_Service SHALL resolve a Navigation_Target with `screen` set to `LeaveList` and `params` containing `leaveId` extracted from the payload.
2. WHEN the Push_Service receives a Notification_Payload with `type` equal to `leave_rejected` and the payload contains a `person_id` field, THE Push_Service SHALL include `personId` in the Navigation_Target params.
3. IF the Notification_Payload with `type` equal to `leave_rejected` is missing the `leaveId` or `leave_id` field, THEN THE Push_Service SHALL return null instead of a Navigation_Target.

### Requirement 3: Admin Leave Pending Notification Deep-Link

**User Story:** As an admin or teacher, I want tapping a "leave pending" notification to open the leave management screen, so that I can review and approve or reject the pending request.

#### Acceptance Criteria

1. WHEN the Push_Service receives a Notification_Payload with `type` equal to `admin_leave_pending`, THE Push_Service SHALL resolve a Navigation_Target with `screen` set to `LeaveManagement` and `params` containing `leaveId` extracted from the payload.
2. WHEN the Push_Service receives a Notification_Payload with `type` equal to `admin_leave_pending` and the payload contains a `person_id` field, THE Push_Service SHALL include `personId` in the Navigation_Target params.
3. IF the Notification_Payload with `type` equal to `admin_leave_pending` is missing the `leaveId` or `leave_id` field, THEN THE Push_Service SHALL return null instead of a Navigation_Target.

### Requirement 4: Role-Aware Navigation Routing

**User Story:** As a user of any role, I want notification taps to route me to the correct tab navigator for my role, so that I land in the appropriate context without seeing another role's interface.

#### Acceptance Criteria

1. WHEN the Navigation_Ref receives a Navigation_Target with `screen` set to `LeaveList`, THE Role_Router SHALL read the user role from Auth_Store and navigate to `ParentTabs > Leave > LeaveList` when the role is Stakeholder.
2. WHEN the Navigation_Ref receives a Navigation_Target with `screen` set to `LeaveManagement` and the Auth_Store role is Admin, THE Role_Router SHALL navigate to `AdminTabs > Management > LeaveManagement`.
3. WHEN the Navigation_Ref receives a Navigation_Target with `screen` set to `LeaveManagement` and the Auth_Store role is SuperAdmin, THE Role_Router SHALL navigate to `AdminTabs > Management > LeaveManagement` via the SuperAdmin_Tabs context.
4. WHEN the Navigation_Ref receives a Navigation_Target with `screen` set to `LeaveManagement` and the Auth_Store role is Teacher, THE Role_Router SHALL navigate to `TeacherTabs > TeacherLeave > LeaveManagement`.
5. IF the Auth_Store role is null or undefined when a leave-related Navigation_Target is received, THEN THE Role_Router SHALL fall back to the Parent_Tabs path as the least-privileged default.

### Requirement 5: Backend Notification Payload Structure

**User Story:** As a mobile developer, I want the backend to send structured IDs in notification payloads, so that the mobile app can navigate to the correct resource without additional API calls.

#### Acceptance Criteria

1. THE Backend_API SHALL include a `type` field in every leave-related Notification_Payload with a value of `leave_approved`, `leave_rejected`, or `admin_leave_pending`.
2. THE Backend_API SHALL include a `leave_id` field in every leave-related Notification_Payload containing the identifier of the leave request.
3. THE Backend_API SHALL include a `person_id` field in `leave_approved` and `leave_rejected` Notification_Payloads containing the identifier of the student the leave pertains to.
4. THE Backend_API SHALL include an `organization_id` field in `admin_leave_pending` Notification_Payloads containing the identifier of the organization.

### Requirement 6: Graceful Handling of Unknown or Malformed Payloads

**User Story:** As a user, I want the app to remain stable even when it receives an unexpected notification payload, so that my experience is never disrupted by malformed data.

#### Acceptance Criteria

1. IF the Push_Service receives a Notification_Payload with an unrecognized `type` value, THEN THE Push_Service SHALL return null and perform no navigation.
2. IF the Push_Service receives a Notification_Payload that is null or not an object, THEN THE Push_Service SHALL return null and perform no navigation.
3. IF the Navigation_Ref receives a Navigation_Target for a screen that has no nested route mapping, THEN THE Navigation_Ref SHALL attempt a flat best-effort navigate call without crashing.
4. WHILE the navigation container is not yet ready, THE Navigation_Ref SHALL no-op any incoming Navigation_Target without throwing an error.

### Requirement 7: Notification Handling Across App States

**User Story:** As a user, I want deep-linking to work whether I tap a notification from a killed state, background state, or while the app is in the foreground, so that I reliably land on the correct screen.

#### Acceptance Criteria

1. WHEN a notification is tapped while the app is in the background or foreground, THE Push_Service SHALL resolve the Navigation_Target and invoke the navigation handler immediately.
2. WHEN a notification launched the app from a killed (cold-start) state, THE RootNavigator SHALL read the last notification response once the navigation container is ready and route it through the Push_Service.
3. THE RootNavigator SHALL process a cold-start notification tap at most once per app launch to prevent duplicate navigation.
