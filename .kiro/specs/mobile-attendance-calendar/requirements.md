# Requirements Document

## Introduction

This feature adds a read-only monthly attendance calendar view to the mobile app's attendance section. Both Admin and Teacher roles can access the calendar from their respective GroupList screens. The calendar displays dates color-coded by attendance marking status, and tapping a date reveals which groups were marked on that day. Teachers see only their assigned groups while Admins see all organization groups.

## Glossary

- **Attendance_Calendar_Screen**: The new monthly calendar screen displayed in the mobile app showing attendance marking status per date.
- **Marked_Date**: A date on which at least one attendance record exists for a given group or set of groups.
- **Unmarked_Date**: A date on which no attendance record exists for a given group or set of groups.
- **Group**: A class or section of students within the organization.
- **Marked_Dates_API**: The existing backend endpoint `GET /api/attendance/marked-dates` that returns dates with attendance records for a group in a given month.
- **Calendar_Component**: The `react-native-calendars` library Calendar component used to render the monthly view.
- **Date_Detail_View**: A UI element (bottom sheet or modal) shown when a user taps a date, listing which groups were marked on that date.
- **Admin_User**: A user with the Admin role who has access to all organization groups.
- **Teacher_User**: A user with the Teacher role who has access only to their assigned groups.
- **Navigation_Entry_Point**: A button or icon on the GroupList screen that navigates to the Attendance_Calendar_Screen.

## Requirements

### Requirement 1: Calendar Navigation Entry Point

**User Story:** As an Admin or Teacher, I want a navigation entry point on the GroupList screen, so that I can quickly access the attendance calendar view.

#### Acceptance Criteria

1. WHEN the Admin GroupList screen renders, THE Navigation_Entry_Point SHALL display a calendar icon button in the screen header that navigates to the Attendance_Calendar_Screen.
2. WHEN the Teacher GroupList screen renders, THE Navigation_Entry_Point SHALL display a calendar icon button in the screen header that navigates to the Attendance_Calendar_Screen.
3. WHEN the user taps the Navigation_Entry_Point, THE Attendance_Calendar_Screen SHALL open within the same attendance navigation stack.

### Requirement 2: Monthly Calendar Display

**User Story:** As an Admin or Teacher, I want to see a monthly calendar with dates color-coded by attendance status, so that I can quickly identify which dates have been marked.

#### Acceptance Criteria

1. THE Attendance_Calendar_Screen SHALL render a Calendar_Component showing the current month by default.
2. THE Attendance_Calendar_Screen SHALL display Marked_Dates with a green dot indicator below the date number.
3. THE Attendance_Calendar_Screen SHALL display Unmarked_Dates without any color indicator.
4. THE Attendance_Calendar_Screen SHALL display a color legend showing the meaning of the green (marked) and default (unmarked) indicators.
5. WHEN the Attendance_Calendar_Screen loads, THE Attendance_Calendar_Screen SHALL fetch marked dates from the Marked_Dates_API for all visible groups in the current month.

### Requirement 3: Month Navigation

**User Story:** As an Admin or Teacher, I want to navigate between months, so that I can view attendance history for previous or upcoming months.

#### Acceptance Criteria

1. WHEN the user taps the left arrow on the Calendar_Component, THE Attendance_Calendar_Screen SHALL display the previous month and fetch the corresponding marked dates.
2. WHEN the user taps the right arrow on the Calendar_Component, THE Attendance_Calendar_Screen SHALL display the next month and fetch the corresponding marked dates.
3. WHILE the Attendance_Calendar_Screen fetches marked dates for a new month, THE Calendar_Component SHALL display a loading indicator.

### Requirement 4: Date Tap Detail View

**User Story:** As an Admin or Teacher, I want to tap a date and see which groups were marked that day, so that I can understand the attendance coverage for that date.

#### Acceptance Criteria

1. WHEN the user taps a date on the Calendar_Component, THE Date_Detail_View SHALL open showing the selected date and a list of groups marked on that date.
2. THE Date_Detail_View SHALL display each group name alongside a status indicator showing whether the group was marked or not marked on the selected date.
3. WHEN no groups have attendance marked on the selected date, THE Date_Detail_View SHALL display a message indicating no attendance was recorded for that date.
4. WHEN the user taps outside the Date_Detail_View or taps a close button, THE Date_Detail_View SHALL dismiss.

### Requirement 5: Teacher Group Filtering

**User Story:** As a Teacher, I want the calendar to show only my assigned groups, so that I see relevant attendance data without confusion.

#### Acceptance Criteria

1. WHILE the current user has the Teacher role, THE Attendance_Calendar_Screen SHALL fetch groups using the useTeacherGroups hook and display only those assigned groups.
2. WHILE the current user has the Teacher role, THE Attendance_Calendar_Screen SHALL request marked dates from the Marked_Dates_API only for groups assigned to the Teacher_User.
3. WHILE the current user has the Teacher role, THE Date_Detail_View SHALL display only groups assigned to the Teacher_User.

### Requirement 6: Admin Group Display

**User Story:** As an Admin, I want the calendar to show all organization groups, so that I can monitor attendance across the entire institution.

#### Acceptance Criteria

1. WHILE the current user has the Admin role, THE Attendance_Calendar_Screen SHALL fetch all organization groups and display marked dates aggregated across all groups.
2. WHILE the current user has the Admin role, THE Date_Detail_View SHALL display all organization groups with their marking status for the selected date.

### Requirement 7: Read-Only Behavior

**User Story:** As an Admin or Teacher, I want the calendar to be strictly a viewing tool, so that accidental attendance modifications cannot occur from this screen.

#### Acceptance Criteria

1. THE Attendance_Calendar_Screen SHALL NOT provide any controls to create, update, or delete attendance records.
2. THE Date_Detail_View SHALL NOT provide any controls to create, update, or delete attendance records.

### Requirement 8: Backend Authorization Extension

**User Story:** As a Teacher, I want the marked-dates endpoint to accept my role, so that the calendar can retrieve my attendance data.

#### Acceptance Criteria

1. WHEN a Teacher_User sends a request to the Marked_Dates_API, THE Marked_Dates_API SHALL authenticate and authorize the request for the Teacher role in addition to the Admin role.
2. WHEN a Teacher_User sends a request to the Marked_Dates_API, THE Marked_Dates_API SHALL return only marked dates for groups assigned to the Teacher_User.
3. IF an unauthenticated request is sent to the Marked_Dates_API, THEN THE Marked_Dates_API SHALL return a 401 Unauthorized response.

### Requirement 9: Loading and Error States

**User Story:** As an Admin or Teacher, I want clear feedback during data loading or when errors occur, so that I understand the state of the calendar.

#### Acceptance Criteria

1. WHILE the Attendance_Calendar_Screen fetches initial data, THE Attendance_Calendar_Screen SHALL display a skeleton loader placeholder.
2. IF the Marked_Dates_API request fails, THEN THE Attendance_Calendar_Screen SHALL display an error message with a retry button.
3. WHEN the user taps the retry button on the error state, THE Attendance_Calendar_Screen SHALL re-fetch the marked dates from the Marked_Dates_API.
