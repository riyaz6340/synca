# Requirements Document

## Introduction

This feature delivers a new, user-friendly **parent-facing application** for the Avento People Presence Platform. The application is built as a **separate, self-contained project in a new top-level folder** and **must not modify any existing code** in the backend (`/src`) or the existing frontend (`/frontend`, including its admin, portal, and superadmin areas).

The new app reuses the existing backend REST API (documented in `docs/AVENTO-PRODUCT-GUIDE.md`, exposed under `/api/auth` and `/api/portal`) in a read-and-submit capacity. It does not add, remove, or alter any backend endpoint or behavior. The goal is a simpler, faster, more approachable experience for parents to check their child's presence status, read announcements, manage leave requests, and view notifications.

### Scope Assumptions (please confirm or correct)

Because the original request ("create a user friendly app") is open-ended, this initial version is based on the following assumptions:

- **Target audience:** Parents / guardians (Stakeholder role), since they are the highest-volume users and benefit most from a friendlier experience.
- **Key flows:** View child presence status, view attendance history, read announcements, view notifications, and submit/track leave requests — all backed by the existing `/api/portal` endpoints.
- **Tech approach:** A new React 18 + TypeScript + Vite single-page application in a new top-level folder (proposed name: `parent-app/`), consuming the existing backend over HTTP. This mirrors the existing stack for consistency while staying fully isolated.
- **Isolation:** The new app has its own `package.json`, dependencies, and build pipeline; it shares no source files with `/frontend` or `/src`.

If any of these assumptions are wrong (for example, the app should target administrators, or use a different framework), tell me and I will revise before we proceed to design.

## Glossary

- **New_App**: The new parent-facing application created in a separate top-level folder; the system being specified by this document.
- **Backend_API**: The existing Avento REST API served under `/api`, including the `/api/auth` and `/api/portal` route groups. It is treated as an external, unmodifiable dependency.
- **Parent**: A human user with the Stakeholder role who is associated with one or more Persons (students) and who authenticates to use the New_App.
- **Person**: A student tracked by Avento and associated with a Parent.
- **Presence_Status**: A Person's attendance state for a given day (for example, Present, Absent, Late, On Leave).
- **Announcement**: A published message from a school relevant to a Parent's associated Persons or Groups.
- **Notification**: A delivery record of a message sent to a Parent.
- **Leave_Request**: A request submitted by a Parent for a Person to be absent over a date range, with a status of Pending, Approved, or Rejected.
- **Auth_Token**: The JWT credential issued by the Backend_API on successful login and used to authorize subsequent requests.
- **Existing_Codebase**: All files under `/src` and `/frontend` that exist prior to this feature.

## Requirements

### Requirement 1: Isolated Project Setup

**User Story:** As the project owner, I want the new app built in a separate folder without changes to existing code, so that the current backend and frontend flows keep working untouched.

#### Acceptance Criteria

1. THE New_App SHALL reside entirely within a single new top-level folder that is a sibling of, and shares no files or subfolders with, `/src` and `/frontend`.
2. THE New_App SHALL include its own dependency manifest and its own build configuration file, both located within the New_App folder and not shared with or referencing the Existing_Codebase.
3. THE New_App SHALL NOT modify, delete, or rename any file or folder within the Existing_Codebase, where the Existing_Codebase is defined as all files and folders present before the New_App folder was created, excluding the New_App folder itself.
4. WHEN a build, test, or run process of the New_App completes, THE New_App SHALL leave every file in the Existing_Codebase byte-for-byte identical to its state before the process started.
5. WHERE the New_App requires the Backend_API base URL, THE New_App SHALL read it exclusively from an environment configuration file located within the New_App folder.
6. IF the Backend_API base URL is absent or empty in the New_App environment configuration file when the New_App starts, THEN THE New_App SHALL halt startup and emit an error indicating the missing Backend_API base URL, without falling back to any hardcoded or Existing_Codebase URL.
7. WHEN the New_App build process completes successfully, THE New_App SHALL write all generated build output to a folder within the New_App folder and SHALL write no build output to `/src` or `/frontend`.

### Requirement 2: Parent Authentication

**User Story:** As a Parent, I want to log in securely, so that I can access information about my child.

#### Acceptance Criteria

1. WHEN a Parent submits a login form containing an email address, a password, and an organization identifier, THE New_App SHALL send an authentication request to the Backend_API and, upon a successful response, store the returned Auth_Token for the active session.
2. IF the Backend_API rejects the submitted credentials, THEN THE New_App SHALL remain on the login screen, retain the entered email address and organization identifier, clear the password field, and display an error message indicating the credentials were not accepted.
3. WHILE a valid Auth_Token is held, THE New_App SHALL include the Auth_Token in the authorization data of each request sent to the Backend_API.
4. WHEN a Parent chooses to log out, THE New_App SHALL send a logout request to the Backend_API, discard the stored Auth_Token, and return to the login screen.
5. IF a Backend_API request returns an unauthorized response, THEN THE New_App SHALL discard the stored Auth_Token and redirect the Parent to the login screen within 1 second.
6. IF a Parent submits the login form with the email address, password, or organization identifier missing or empty, THEN THE New_App SHALL suppress the authentication request, remain on the login screen, and display an error message identifying the missing field or fields.
7. IF the Backend_API does not return a response to an authentication request within 30 seconds, THEN THE New_App SHALL cancel the request, remain on the login screen, and display an error message indicating the service could not be reached.

### Requirement 3: View Child Presence Status

**User Story:** As a Parent, I want to see each child's current presence status, so that I know whether my child is at school today.

#### Acceptance Criteria

1. WHEN an authenticated Parent opens the home view, THE New_App SHALL request the Parent's associated Persons and their Presence_Status for the current calendar day from the Backend_API, and SHALL complete the request or display an outcome (data, empty state, or error) within 5 seconds under normal network conditions.
2. WHEN the Backend_API returns the associated Persons, THE New_App SHALL display, for each associated Person, the Person's name and a Presence_Status value that is exactly one of: "Present", "Absent", "Late", "On_Leave", or "Not yet marked".
3. IF a Person has no attendance record for the current calendar day, THEN THE New_App SHALL display a Presence_Status of "Not yet marked" for that Person.
4. IF the Backend_API returns no associated Persons for the Parent, THEN THE New_App SHALL display a message stating that no children are linked to the account, and SHALL NOT display any Person rows.
5. IF the Backend_API request fails or does not complete within 5 seconds, THEN THE New_App SHALL display an error message indicating that presence status could not be retrieved, SHALL NOT display any Person presence rows, and SHALL provide a control to retry the request.
6. WHILE the Backend_API request is in progress, THE New_App SHALL display a loading indicator and SHALL NOT display any Person presence rows.

### Requirement 4: View Attendance History

**User Story:** As a Parent, I want to view my child's attendance history over a date range, so that I can track attendance patterns.

#### Acceptance Criteria

1. WHEN a Parent selects a Person associated with the Parent's account, THE New_App SHALL retrieve that Person's attendance records from the Backend_API.
2. WHERE a Parent specifies a start date and an end date, THE New_App SHALL request attendance records whose date is greater than or equal to the start date and less than or equal to the end date, with both bounds inclusive.
3. WHEN the Backend_API returns attendance records, THE New_App SHALL display each record with its date and a Presence_Status value that is exactly one of "Present", "Absent", "Late", or "On_Leave", ordered by date descending with the most recent record first.
4. IF a Parent submits a start date or end date that is not in YYYY-MM-DD format, THEN THE New_App SHALL display a validation message indicating the required date format and SHALL NOT send the request.
5. IF the selected date range contains no attendance records, THEN THE New_App SHALL display an empty-state message referencing the selected range.
6. IF the end date is earlier than the start date, THEN THE New_App SHALL display a validation message and SHALL NOT send the request.
7. IF the Backend_API request fails or does not respond within 10 seconds, THEN THE New_App SHALL display an error message indicating that attendance history could not be retrieved, SHALL retain the Parent's selected Person and date range, and SHALL provide a control to retry the request.

### Requirement 5: Read Announcements

**User Story:** As a Parent, I want to read announcements relevant to my child, so that I stay informed about school notices.

#### Acceptance Criteria

1. WHEN an authenticated Parent opens the announcements view, THE New_App SHALL request from the Backend_API the published Announcements targeted to the Parent's associated children, scoped to the Parent's organization.
2. WHEN the Backend_API returns one or more published Announcements, THE New_App SHALL display each Announcement's title, body, and published date, ordered by published date from most recent to oldest, within 3 seconds of receiving the response.
3. WHILE the New_App is awaiting the Backend_API response, THE New_App SHALL display a loading indicator.
4. IF the Backend_API returns zero published Announcements, THEN THE New_App SHALL display an empty-state message indicating that no announcements are available.
5. IF the Backend_API request fails or does not return a successful response within 10 seconds, THEN THE New_App SHALL display an error message indicating that announcements could not be loaded, SHALL NOT display partial Announcement data, and SHALL provide a retry control.

### Requirement 6: View Notifications

**User Story:** As a Parent, I want to view my notifications, so that I can review alerts the school has sent me.

#### Acceptance Criteria

1. WHEN an authenticated Parent opens the notifications view, THE New_App SHALL request the Parent's Notifications from the Backend_API ordered by sent date descending, falling back to created date descending when a Notification has no sent date, with a page size of 20.
2. WHEN the Backend_API returns Notifications, THE New_App SHALL display each Notification's title, body, and sent date, displaying the created date in place of the sent date when no sent date exists.
3. WHERE more Notifications exist than have been retrieved, THE New_App SHALL provide a control to load the next page that increments the page parameter while keeping the page size at 20.
4. IF the Backend_API returns no Notifications for the Parent, THEN THE New_App SHALL display an empty-state message.
5. WHILE the New_App is awaiting the Backend_API response, THE New_App SHALL display a loading indicator.
6. IF the Backend_API request fails or does not return a successful response, THEN THE New_App SHALL display an error message indicating that notifications could not be loaded, SHALL retain any previously displayed Notifications, and SHALL provide a control to retry the request.

### Requirement 7: Submit and Track Leave Requests

**User Story:** As a Parent, I want to submit and track leave requests for my child, so that I can report planned absences without contacting the school directly.

#### Acceptance Criteria

1. WHEN a Parent submits a Leave_Request with a Person, a start date, an end date, and a reason, THE New_App SHALL send the request to the Backend_API with the start date and end date formatted as YYYY-MM-DD.
2. IF the end date precedes the start date, THEN THE New_App SHALL display a validation message and SHALL NOT send the request to the Backend_API.
3. IF any required Leave_Request field (Person, start date, end date, or reason) is empty, or the reason contains only whitespace, THEN THE New_App SHALL display a validation message identifying the missing field and SHALL NOT send the request to the Backend_API.
4. WHEN the Backend_API confirms a submitted Leave_Request, THE New_App SHALL display a confirmation message, clear the submission form, and display the request in the leave requests list with a status of Pending.
5. WHEN an authenticated Parent opens the leave requests view, THE New_App SHALL retrieve from the Backend_API and display all existing Leave_Requests submitted by that Parent, each showing its Person, start date, end date, reason, and current status of Pending, Approved, or Rejected.
6. IF the Backend_API rejects or fails to process a submitted Leave_Request, THEN THE New_App SHALL display an error message indicating that the submission failed and SHALL retain the Parent's entered field values to allow resubmission.
7. IF retrieving Leave_Requests from the Backend_API fails, THEN THE New_App SHALL display an error message indicating that the leave requests could not be loaded.
8. WHEN the leave requests view is opened and no Leave_Requests exist for the Parent, THE New_App SHALL display a message indicating that there are no leave requests.

### Requirement 8: User-Friendly Experience

**User Story:** As a Parent, I want the app to be simple, responsive, and clear, so that I can use it comfortably on my phone.

#### Acceptance Criteria

1. WHILE rendered on a viewport width between 320px and 767px (mobile), THE New_App SHALL present a single-column layout that displays all interactive controls and content without requiring horizontal scrolling.
2. WHILE rendered on a viewport width of 768px or greater (desktop), THE New_App SHALL present a layout that displays all interactive controls and content without requiring horizontal scrolling.
3. WHILE a Backend_API request for a view is in progress, THE New_App SHALL display a loading indicator for that view within 1 second of the request starting and SHALL remove the indicator when the request completes or fails.
4. IF a Backend_API request fails due to a network error or a server error response, THEN THE New_App SHALL display an error message indicating the request failed.
5. IF a Backend_API request fails due to a network error or a server error response, THEN THE New_App SHALL display a retry control that re-issues the same request when activated, and SHALL retain any previously loaded data for the affected view until the retry succeeds.
6. IF a Backend_API request does not receive a response within 30 seconds, THEN THE New_App SHALL treat the request as failed and SHALL display an error message indicating the request timed out.
7. THE New_App SHALL provide navigation controls to move between the presence, attendance, announcements, notifications, and leave request views, with each control rendering a touch target of at least 44px by 44px.

### Requirement 9: Backend API Integrity

**User Story:** As the project owner, I want the existing backend to remain unchanged, so that current users and flows are unaffected by the new app.

#### Acceptance Criteria

1. THE New_App SHALL send all Backend_API requests exclusively to endpoints that already exist under the `/api/auth` and `/api/portal` paths, using only the request methods, parameters, and payload structures already defined by those endpoints.
2. THE New_App SHALL NOT require the addition, modification, or removal of any Backend_API endpoint, request schema, or response schema.
3. WHERE the New_App requires data that is not exposed by an existing endpoint, THE New_App SHALL omit that data and SHALL NOT trigger any addition or modification to the Backend_API.
4. IF the New_App receives a non-success response from a Backend_API request, THEN THE New_App SHALL handle the response within the New_App, present an error indication to the user, and SHALL NOT retry against any non-existing or altered endpoint.
5. IF a request is directed to any path other than `/api/auth` or `/api/portal`, THEN THE New_App SHALL block the request before it is sent and SHALL record an error indication of the disallowed call.
