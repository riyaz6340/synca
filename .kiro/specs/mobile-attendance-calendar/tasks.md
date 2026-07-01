# Implementation Plan: Mobile Attendance Calendar

## Overview

Add a read-only monthly attendance calendar to the mobile app for both Admin and Teacher roles. Implementation covers a minor backend authorization extension, new utility functions, React Query hooks, UI components, and navigation wiring. The calendar uses `react-native-calendars` and follows the existing app patterns (React Query, Zustand auth store, permission-gated navigation).

## Tasks

- [x] 1. Backend: Extend marked-dates endpoint for Teacher role
  - [x] 1.1 Update authorization and add teacher group validation
    - In `src/routes/attendance.ts`, change `authorize('Admin')` to `authorize('Admin', 'Teacher')` on the `GET /marked-dates` route
    - Add a guard that checks `teacher_group_assignments` for Teacher role requests and returns 403 if the teacher is not assigned to the requested group
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 1.2 Write unit tests for backend authorization extension
    - Test that Teacher role is accepted and returns marked dates for assigned groups
    - Test that Teacher role receives 403 for unassigned groups
    - Test that Admin role continues to work without group assignment checks
    - Test that unauthenticated requests return 401
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Mobile: Install dependency and create utility module
  - [x] 2.1 Install react-native-calendars package
    - Run `npm install react-native-calendars` in `avento-mobile/`
    - Verify the package resolves correctly and does not conflict with existing dependencies
    - _Requirements: 2.1_

  - [x] 2.2 Create `src/utils/calendarUtils.ts` with pure utility functions
    - Implement `buildMarkedDatesMap(markedDatesByGroup)` — transforms MarkedDatesByGroup into react-native-calendars MarkedDates format
    - Implement `isDateMarked(date, markedDatesByGroup)` — returns true if date appears in any group's marked dates
    - Implement `getAllMarkedDates(markedDatesByGroup)` — returns all unique marked dates from all groups
    - Implement `filterGroupsByIds(groups, allowedIds)` — filters groups to those in the allowed set
    - _Requirements: 2.2, 2.3, 5.1_

  - [ ]* 2.3 Write property tests for `buildMarkedDatesMap`
    - **Property 1: Date marking indicator correctness**
    - A date receives a green dot if and only if it appears in at least one group's marked dates list
    - Use fast-check to generate arbitrary MarkedDatesByGroup maps and verify output correctness
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 2.4 Write property tests for `computeGroupDateStatuses`
    - **Property 2: Date detail view shows correct group statuses**
    - For any date, groups, and markedDatesByGroup, each group's `isMarked` is true iff the date is in that group's array
    - Use fast-check to generate arbitrary inputs
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.5 Write property tests for `filterGroupsByIds`
    - **Property 3: Teacher group filtering completeness**
    - For any set of groups and allowed IDs, only groups whose IDs are in the allowed set are returned
    - Use fast-check to generate arbitrary group lists and ID sets
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 3. Mobile: Create React Query hooks
  - [x] 3.1 Create `src/hooks/useMarkedDates.ts`
    - Implement the `useMarkedDates` hook that fetches marked dates for multiple groups in parallel via `Promise.all`
    - Accept `{ groupIds, year, month, enabled }` params
    - Return `MarkedDatesByGroup` (Record<string, string[]>)
    - Use query key `['attendance', 'marked-dates', { groupIds, year, month }]`
    - _Requirements: 2.5, 5.2, 6.1_

  - [x] 3.2 Create `src/hooks/useAllGroups.ts`
    - Implement the `useAllGroups` hook that fetches all organization groups for Admin users
    - Use query key `['admin', 'groups']` and call `adminApi.getGroups()`
    - Accept `{ enabled }` option to prevent fetching for Teacher role
    - _Requirements: 6.1, 6.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Mobile: Create UI components
  - [x] 5.1 Create `src/components/CalendarLegend.tsx`
    - Render a horizontal row with green dot + "Marked" label and gray dot + "Unmarked" label
    - Use existing `colors` and `spacing` from `src/components/theme.ts`
    - Include `testID="calendar-legend"` for testing
    - _Requirements: 2.4_

  - [x] 5.2 Create `src/components/DateDetailModal.tsx`
    - Implement modal showing selected date formatted in `en-IN` locale
    - Display list of groups with marked/not-marked status indicators
    - Show empty message when no groups are marked on the selected date
    - Export the pure `computeGroupDateStatuses` function for testing
    - Include dismiss via overlay press and close button
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2_

  - [x] 5.3 Create `src/screens/attendance/AttendanceCalendarScreen.tsx`
    - Use `useAuthStore` to determine role and conditionally use `useTeacherGroups` or `useAllGroups`
    - Track `currentMonth` state and `selectedDate` state
    - Call `useMarkedDates` with resolved group IDs
    - Render `Calendar` from react-native-calendars with `markingType="dot"`
    - Render `CalendarLegend` and `DateDetailModal`
    - Show `SkeletonLoader` during initial load and `ErrorState` on failure
    - Must be read-only — no mutation controls
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 5.1, 6.1, 7.1, 9.1, 9.2, 9.3_

- [x] 6. Mobile: Navigation integration
  - [x] 6.1 Register AttendanceCalendar screen in Admin and Teacher attendance stacks
    - In `src/navigation/AdminTabNavigator.tsx`, add `AttendanceCalendar` screen to `AttendanceStack` with `AttendanceCalendarScreen` component
    - In `src/navigation/TeacherTabNavigator.tsx`, add `AttendanceCalendar` screen to `AttendanceStack` with `AttendanceCalendarScreen` component
    - Update navigation type definitions in `src/types/navigation.ts` to include `AttendanceCalendar: undefined` in both `AdminAttendanceStackParamList` and `TeacherAttendanceStackParamList`
    - _Requirements: 1.3_

  - [x] 6.2 Add calendar navigation entry point to GroupList screens
    - In Admin `GroupListScreen` (`src/screens/admin/GroupListScreen.tsx`), add a calendar icon button in the header that navigates to `AttendanceCalendar`
    - In Teacher `TeacherGroupListScreen` (`src/screens/teacher/TeacherGroupListScreen.tsx`), add a calendar icon button in the header that navigates to `AttendanceCalendar`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8. Write integration/unit tests for calendar components
  - [ ]* 8.1 Write unit tests for CalendarLegend rendering
    - Verify legend renders both "Marked" and "Unmarked" items with correct colors
    - _Requirements: 2.4_

  - [ ]* 8.2 Write unit tests for DateDetailModal
    - Test modal renders group statuses correctly when given marked data
    - Test empty state message when no attendance recorded
    - Test dismiss callbacks
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 8.3 Write unit tests for AttendanceCalendarScreen
    - Test skeleton loader displays during loading
    - Test error state with retry button on API failure
    - Test read-only constraint (no mutation controls rendered)
    - _Requirements: 9.1, 9.2, 9.3, 7.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `react-native-calendars` library is the only new dependency required
- All components follow existing patterns: React Query for data, Zustand for auth state, and theme constants for styling

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "3.1", "3.2"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
