# Implementation Plan: Parent-Friendly App

## Overview

Build a new, isolated parent-facing single-page application (`parent-app/`) using React 18 + TypeScript + Vite. The app consumes the existing backend REST API in a read-and-submit capacity and provides parents (Stakeholder role) with five flows: authentication, child presence status, attendance history, announcements, notifications, and leave requests. All code lives in a new top-level folder with its own manifest and build pipeline — no existing file is modified.

## Tasks

- [x] 1. Set up project structure and configuration
  - [x] 1.1 Scaffold the `parent-app/` project folder with `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, and directory structure (`src/config`, `src/api`, `src/lib`, `src/context`, `src/components`, `src/hooks`, `src/pages`)
    - Install dependencies: react, react-dom, react-router-dom, axios
    - Install dev dependencies: typescript, vite, @vitejs/plugin-react, vitest, fast-check, @testing-library/react, @testing-library/jest-dom, jsdom
    - Configure Vite with `outDir: 'dist'` inside `parent-app/`
    - Document `VITE_API_URL` in `.env.example`
    - _Requirements: 1.1, 1.2, 1.5, 1.7_

  - [x] 1.2 Implement the Config Loader (`src/config/env.ts`)
    - Export `loadApiBaseUrl()` that reads `import.meta.env.VITE_API_URL`
    - Throw `ConfigError` if the value is missing, empty, or whitespace-only
    - Export `ConfigError` class extending `Error`
    - _Requirements: 1.5, 1.6_

  - [x] 1.3 Create the app entry point (`src/main.tsx`)
    - Call `loadApiBaseUrl()` before mounting React
    - On `ConfigError`, render a static configuration-error screen without mounting the router
    - On success, render `<App />` with the router
    - _Requirements: 1.6_

- [x] 2. Implement pure logic layer and property tests
  - [x] 2.1 Implement path allowlist guard (`src/lib/allowlist.ts`)
    - Export `ALLOWED_PREFIXES` array: `/api/auth`, `/api/portal`, `/api/leave-requests`
    - Export `isAllowedPath(path: string): boolean` — normalize path, check prefix match
    - Export `assertAllowedPath(path: string): void` — throws `DisallowedRequestError` with the offending path
    - Export `DisallowedRequestError` class
    - _Requirements: 9.1, 9.5_

  - [ ]* 2.2 Write property test for path allowlist guard
    - **Property 10: Path allowlist guard**
    - Generate arbitrary path strings (allowed prefixes with suffixes, random paths, paths with query strings, edge cases like partial prefix matches)
    - Assert: permit iff starts with an allowed prefix; block otherwise
    - **Validates: Requirements 9.1, 9.5**

  - [x] 2.3 Implement date validation and range checking (`src/lib/dates.ts`)
    - Export `isValidDateFormat(value: string): boolean` — strict YYYY-MM-DD with calendar validation
    - Export `isValidRange(range: DateRange): boolean` — end >= start, both valid format
    - _Requirements: 4.4, 4.6, 7.2_

  - [ ]* 2.4 Write property test for date-format validation
    - **Property 5: Strict date-format validation**
    - Generate valid YYYY-MM-DD dates and invalid strings (wrong separators, out-of-range months/days, non-numeric, empty)
    - Assert: returns true iff strictly well-formed calendar date
    - **Validates: Requirements 4.4**

  - [ ]* 2.5 Write property test for date-range ordering validation
    - **Property 6: Date-range ordering validation**
    - Generate pairs of valid dates in various orderings
    - Assert: succeeds iff end >= start; fails otherwise
    - **Validates: Requirements 4.6, 7.2**

  - [x] 2.6 Implement presence-status derivation (`src/lib/presence.ts`)
    - Export `toDisplayStatus(person: PersonWithStatus): DisplayPresenceStatus`
    - Return `'Not yet marked'` when `current_status` is null, otherwise return the `presence_status` value
    - _Requirements: 3.2, 3.3_

  - [ ]* 2.7 Write property test for presence-status derivation
    - **Property 3: Presence status derivation is total and correct**
    - Generate `PersonWithStatus` objects with null and non-null `current_status`
    - Assert: result is exactly one of the five values; equals 'Not yet marked' iff `current_status` is null
    - **Validates: Requirements 3.2, 3.3**

  - [x] 2.8 Implement sorting functions (`src/lib/sorting.ts`)
    - Export `sortAttendanceByDateDesc(records: AttendanceRecord[]): AttendanceRecord[]`
    - Export `sortAnnouncementsByPublishedDesc(announcements: Announcement[]): Announcement[]`
    - Export `sortNotificationsByEffectiveDateDesc(notifications: Notification[]): Notification[]` — use `sent_at ?? created_at`
    - All functions return a new sorted array (permutation of input, no records added/dropped)
    - _Requirements: 4.3, 5.2, 6.1, 6.2_

  - [ ]* 2.9 Write property test for attendance sorting
    - **Property 4: Attendance history is ordered by date descending**
    - Generate lists of `AttendanceRecord` with arbitrary and duplicate dates
    - Assert: output is a permutation of input with dates in non-increasing order
    - **Validates: Requirements 4.3**

  - [ ]* 2.10 Write property test for announcements sorting
    - **Property 7: Announcements are ordered by published date descending**
    - Generate lists of `Announcement` with arbitrary `published_at` timestamps
    - Assert: output is a permutation of input with published dates in non-increasing order
    - **Validates: Requirements 5.2**

  - [ ]* 2.11 Write property test for notifications sorting
    - **Property 8: Notifications are ordered by effective date descending**
    - Generate lists of `Notification` with null and non-null `sent_at`, arbitrary `created_at`
    - Assert: effective date = `sent_at ?? created_at`; output is a permutation of input with effective dates in non-increasing order
    - **Validates: Requirements 6.1, 6.2**

  - [x] 2.12 Implement leave-request validation (`src/lib/leave.ts`)
    - Export `validateLeaveSubmit(input: LeaveSubmitInput): LeaveValidationResult`
    - Check: all required fields present, reason is non-whitespace, date range valid per `isValidRange`
    - Return `{ ok, errors }` with exactly the offending fields
    - _Requirements: 7.2, 7.3_

  - [ ]* 2.13 Write property test for leave-request validation
    - **Property 9: Leave-request submission validation**
    - Generate `LeaveSubmitInput` with combinations of empty/whitespace/valid fields
    - Assert: fails iff any field is empty or reason is whitespace-only or range invalid; reports exactly the offending fields
    - **Validates: Requirements 7.3**

  - [x] 2.14 Implement login validation (`src/lib/loginValidation.ts`)
    - Export `validateLoginFields(email, password, organization): { ok: boolean; missingFields: string[] }`
    - Return exactly the set of fields that are missing or whitespace-only
    - _Requirements: 2.6_

  - [ ]* 2.15 Write property test for login validation
    - **Property 2: Login validation flags exactly the missing fields**
    - Generate combinations of email, password, organization with empty/whitespace variants
    - Assert: fails when any field is empty/whitespace; reports exactly the missing fields
    - **Validates: Requirements 2.6**

- [x] 3. Implement API client and type definitions
  - [x] 3.1 Define TypeScript data models and interfaces (`src/api/types.ts`)
    - Define all types: `PresenceStatus`, `DisplayPresenceStatus`, `ParentUser`, `Organization`, `PersonWithStatus`, `AttendanceRecord`, `Announcement`, `Notification`, `LeaveStatus`, `LeaveRequest`, `DateRange`, `LeaveSubmitInput`, `Pagination`, `LoginInput`, `LoginResponse`, `ViewState`
    - _Requirements: 3.2, 4.3, 5.2, 6.1, 7.5_

  - [x] 3.2 Implement the API client (`src/api/client.ts`)
    - Create axios instance with `baseURL` from config loader
    - Add request interceptor: attach `Authorization: Bearer <token>` when token is held
    - Add request interceptor: run `assertAllowedPath()` on every outgoing request
    - Add response interceptor: on 401, clear token and redirect to login within 1 second
    - Set per-request timeout defaults (5s presence, 10s attendance/announcements, 30s auth/default)
    - _Requirements: 2.3, 2.5, 9.1, 9.5, 8.6_

  - [ ]* 3.3 Write property test for token attachment
    - **Property 1: Token is attached to every outgoing request**
    - Generate arbitrary valid tokens and allowed endpoint paths
    - Assert: outgoing request header contains `Authorization: Bearer <token>` exactly matching the held token
    - **Validates: Requirements 2.3**

  - [x] 3.4 Implement typed endpoint wrappers (`src/api/endpoints.ts`)
    - Export `authApi`: `login`, `refresh`, `logout`, `listOrganizations`
    - Export `portalApi`: `getChildren`, `getAttendance`, `getNotifications`, `getAnnouncements`
    - Export `leaveApi`: `list`, `submit`
    - Each wrapper sets the appropriate per-call timeout
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 5.1, 6.1, 7.1, 7.5_

- [x] 4. Checkpoint - Verify core logic and API layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement authentication context and protected routing
  - [x] 5.1 Implement Auth Context (`src/context/AuthContext.tsx`)
    - Provide `token`, `user`, `isAuthenticated`, `isLoading`, `login()`, `logout()`
    - On mount: attempt silent refresh if stored token exists
    - `login()`: call `authApi.login`, store token on success
    - `logout()`: call `authApi.logout`, discard token, redirect to login
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 5.2 Implement ProtectedRoute component (`src/components/ProtectedRoute.tsx`)
    - Redirect unauthenticated users to login page
    - Show loading state during auth check
    - _Requirements: 2.5_

  - [-] 5.3 Implement App shell and routing (`src/App.tsx`)
    - Configure React Router with routes: `/login`, `/` (home/presence), `/attendance`, `/announcements`, `/notifications`, `/leave`
    - Wrap protected routes in `ProtectedRoute`
    - Include `AppNav` component for authenticated views
    - _Requirements: 8.7_

- [x] 6. Implement shared UI components
  - [x] 6.1 Create shared components (`src/components/`)
    - `LoadingIndicator.tsx` — displayed while requests are in progress
    - `EmptyState.tsx` — displayed when no data is returned
    - `ErrorWithRetry.tsx` — error message with retry button
    - `AppNav.tsx` — navigation bar with ≥44×44px touch targets linking the five views
    - _Requirements: 8.3, 8.4, 8.5, 8.7_

- [ ] 7. Implement data hooks
  - [-] 7.1 Implement `useChildren` hook (`src/hooks/useChildren.ts`)
    - Manage `ViewState<PersonWithStatus[]>` with loading/success/empty/error states
    - Call `portalApi.getChildren()`, apply `toDisplayStatus` mapping
    - Expose `retry()` callback
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [-] 7.2 Implement `useAttendance` hook (`src/hooks/useAttendance.ts`)
    - Accept `personId` and `DateRange` parameters
    - Validate date range with `isValidDateFormat` and `isValidRange` before requesting
    - Call `portalApi.getAttendance()`, apply `sortAttendanceByDateDesc`
    - Manage view state and expose `retry()`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.7_

  - [-] 7.3 Implement `useAnnouncements` hook (`src/hooks/useAnnouncements.ts`)
    - Call `portalApi.getAnnouncements()`, apply `sortAnnouncementsByPublishedDesc`
    - Manage view state and expose `retry()`
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [-] 7.4 Implement `useNotifications` hook (`src/hooks/useNotifications.ts`)
    - Page size 20; provide `loadMore()` to fetch next page
    - Apply `sortNotificationsByEffectiveDateDesc`
    - Retain previously loaded notifications on error
    - Manage view state and expose `retry()`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [~] 7.5 Implement `useLeaveRequests` hook (`src/hooks/useLeaveRequests.ts`)
    - Provide `submit(input)` that validates with `validateLeaveSubmit` before sending
    - Call `leaveApi.list()` and `leaveApi.submit()`
    - Manage view state and expose `retry()`
    - _Requirements: 7.1, 7.3, 7.5, 7.6, 7.7, 7.8_

- [ ] 8. Implement page views
  - [~] 8.1 Implement LoginPage (`src/pages/LoginPage.tsx`)
    - Email, password, organization fields with client-side validation via `validateLoginFields`
    - On rejection: retain email + organization, clear password, show error
    - Handle 30s auth timeout with service-unreachable message
    - _Requirements: 2.1, 2.2, 2.6, 2.7_

  - [~] 8.2 Implement HomePage / Presence view (`src/pages/HomePage.tsx`)
    - Use `useChildren` hook; display each child with name and derived presence status
    - Show loading indicator, empty state, or error+retry as appropriate
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [~] 8.3 Implement AttendancePage (`src/pages/AttendancePage.tsx`)
    - Child selector + start/end date inputs
    - Client-side date format and range validation with inline error messages
    - Display records ordered by date descending with date and status
    - Empty state, error+retry, retain selections on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [~] 8.4 Implement AnnouncementsPage (`src/pages/AnnouncementsPage.tsx`)
    - Display title, body, published date for each announcement, most-recent first
    - Loading indicator, empty state, error+retry
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [~] 8.5 Implement NotificationsPage (`src/pages/NotificationsPage.tsx`)
    - Display title, body, and effective date (sent_at or created_at fallback)
    - Load-more control for pagination (page size 20)
    - Retain previously loaded notifications on error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [~] 8.6 Implement LeaveRequestsPage (`src/pages/LeaveRequestsPage.tsx`)
    - Submission form: person selector, start date, end date, reason
    - Client-side validation with `validateLeaveSubmit`; inline error messages
    - On success: confirmation message, clear form, show request as Pending in list
    - On failure: error message, retain entered values
    - List existing leave requests with person, dates, reason, and status
    - Empty state when no requests exist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 9. Implement responsive layout and mobile-first styling
  - [~] 9.1 Add global styles and responsive layout (`src/index.css` or equivalent)
    - Single-column layout for viewports 320–767px (mobile)
    - Appropriate layout for viewports ≥768px (desktop)
    - No horizontal scrolling at any viewport width
    - Navigation touch targets ≥44×44px
    - _Requirements: 8.1, 8.2, 8.7_

- [~] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–10)
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript throughout, matching the design document
- All code resides exclusively within `parent-app/` — no files outside this folder are created or modified
- The backend is treated as an unmodifiable external dependency; only existing endpoints are used

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.3", "2.6", "2.8", "2.12", "2.14"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.5", "2.7", "2.9", "2.10", "2.11", "2.13", "2.15", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 6, "tasks": ["5.3", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 8, "tasks": ["9.1"] }
  ]
}
```
