# Implementation Plan: Push Notification Deep-Linking for Leave Notifications

## Overview

Extend the existing push notification deep-linking infrastructure to handle leave-related notification types (`leave_approved`, `leave_rejected`, `admin_leave_pending`) with role-aware routing. The implementation touches three layers: backend notification payloads, the push service's pure resolution function, and the navigation ref's role-aware router.

## Tasks

- [x] 1. Extend Push Service with leave notification resolution
  - [x] 1.1 Add leave notification cases to `resolveNavigationTarget` in `src/services/pushNotifications.ts`
    - Add `case 'leave_approved':` and `case 'leave_rejected':` that resolve to `{ screen: 'LeaveList', params: { leaveId, personId? } }`
    - Add `case 'admin_leave_pending':` that resolves to `{ screen: 'LeaveManagement', params: { leaveId, personId?, organizationId? } }`
    - Extract `leaveId` from either `data.leaveId` or `data.leave_id`; return `null` if neither is present
    - Extract optional `personId` from `data.personId` or `data.person_id`
    - Extract optional `organizationId` from `data.organizationId` or `data.organization_id` (admin_leave_pending only)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 6.1, 6.2_

  - [ ]* 1.2 Write property tests for `resolveNavigationTarget` leave cases
    - **Property 1: Leave notification resolution produces correct screen**
    - **Property 2: Admin leave pending resolution produces correct screen**
    - **Property 3: Optional person_id inclusion**
    - **Property 4: Missing leave ID returns null**
    - **Property 7: Unknown notification types return null**
    - **Property 8: Non-object payloads return null**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 6.1, 6.2**

  - [ ]* 1.3 Write unit tests for `resolveNavigationTarget` leave cases
    - Test `leave_approved` with valid `leave_id` and `person_id` returns correct target
    - Test `leave_rejected` with valid `leaveId` (camelCase) returns correct target
    - Test `admin_leave_pending` with `leave_id`, `person_id`, and `organization_id` returns correct target
    - Test missing `leave_id` returns null for each type
    - Test null/undefined/non-object payload returns null
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 6.1, 6.2_

- [x] 2. Implement role-aware navigation routing
  - [x] 2.1 Update `nestedRouteFor` in `src/navigation/navigationRef.ts` to accept a `role` parameter
    - Change the signature from `nestedRouteFor(target)` to `nestedRouteFor(target, role)`
    - Import `AppRole` type from `@/types/auth`
    - Add `case 'LeaveList':` that routes to `ParentTabs > Leave > LeaveList` regardless of role
    - Add `case 'LeaveManagement':` with role-based switch:
      - `'Admin'` → `AdminTabs > Management > LeaveManagement`
      - `'SuperAdmin'` → `SuperAdminTabs > Organizations > OrgList`
      - `'Teacher'` → `TeacherTabs > TeacherLeave > LeaveManagement`
      - `default` (null/undefined) → `ParentTabs > Leave > LeaveList` (least-privileged fallback)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.2 Update `navigateToTarget` to read role from auth store and pass to `nestedRouteFor`
    - Import `useAuthStore` from `@/stores/auth`
    - Read `useAuthStore.getState().user?.role ?? null` before dispatching
    - Pass the role as the second argument to `nestedRouteFor(target, role)`
    - Preserve all existing behavior (readiness guard, flat fallback for unmapped screens)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.3, 6.4_

  - [ ]* 2.3 Write property tests for `nestedRouteFor` role-aware routing
    - **Property 5: Role-aware routing maps leave targets to correct tab navigator**
    - **Property 6: LeaveList always routes to ParentTabs**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 2.4 Write unit tests for `navigateToTarget` with role-aware leave routing
    - Test `LeaveList` target routes to `ParentTabs > Leave > LeaveList` for Stakeholder role
    - Test `LeaveManagement` target routes to `AdminTabs > Management > LeaveManagement` for Admin role
    - Test `LeaveManagement` target routes to `SuperAdminTabs > Organizations > OrgList` for SuperAdmin role
    - Test `LeaveManagement` target routes to `TeacherTabs > TeacherLeave > LeaveManagement` for Teacher role
    - Test null role falls back to `ParentTabs > Leave > LeaveList`
    - Test existing `AttendanceHistory` and `AnnouncementDetail` routing still works
    - Test navigation not ready still no-ops
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.3, 6.4_

- [x] 3. Checkpoint — Verify mobile push routing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update backend notification payloads to include entity IDs
  - [x] 4.1 Update `leave_approved` notification in `src/routes/leaveRequests.ts` to include `leave_id` and `person_id` in data payload
    - Modify the `createNotification` call for `leave_approved` to include `data: { leave_id: id, person_id: leaveRequest.person_id }`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Update `leave_rejected` notification in `src/routes/leaveRequests.ts` to include `leave_id` and `person_id` in data payload
    - Modify the `createNotification` call for `leave_rejected` to include `data: { leave_id: id, person_id: leaveRequest.person_id }`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.3 Add `admin_leave_pending` notification when a new leave request is created
    - In the POST route for creating leave requests, after the leave is created, send a notification to the relevant admin/teacher
    - Include `data: { leave_id: newLeaveId, person_id: leaveRequest.person_id, organization_id: organizationId }` in the notification payload
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 5. Checkpoint — Verify backend payloads and end-to-end flow
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Cold-start and app-state handling verification
  - [x] 6.1 Verify cold-start notification handling in `RootNavigator`
    - Confirm `handleNavigatorReady` reads `getLastNotificationResponseAsync` and passes it through `handleNotificationTapped`
    - Confirm `coldStartHandledRef` prevents duplicate processing
    - Add a test if one does not already exist that verifies at-most-once cold-start processing
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.2 Write unit tests for cold-start and background tap scenarios
    - Test that background tap invokes `resolveNavigationTarget` → `navigateToTarget` end-to-end
    - Test that cold-start response is processed once and only once
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `nestedRouteFor` function must be exported (or tested indirectly through `navigateToTarget`) for property testing
- Backend task 4.3 may require identifying the correct admin/teacher recipients for the `admin_leave_pending` notification — coordinate with existing role/group logic

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "4.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "4.3"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "6.1"] },
    { "id": 4, "tasks": ["6.2"] }
  ]
}
```
