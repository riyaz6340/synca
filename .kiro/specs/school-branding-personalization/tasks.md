# Implementation Plan: School Branding Personalization

## Overview

This plan implements organization/school branding across the backend API, Admin Panel (React/Vite), and Mobile App (React Native/Expo). The implementation follows a bottom-up approach: backend first, then state management, then UI components. TypeScript is used throughout all layers.

## Tasks

- [x] 1. Backend: Organization Name API and Login Enhancement
  - [x] 1.1 Add GET /api/organization/name endpoint
    - Add a new route handler in `src/routes/organization.ts`
    - Extract `organization_id` from the authenticated JWT
    - Query the `organizations` table for the `name` column using the extracted ID
    - Return `{ organization_name: string }` on success
    - Return 404 `{ error: "Organization not found" }` if no record matches
    - Apply `authenticate` and `tenantIsolation` middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Enhance login response to include organization_name
    - Modify `src/routes/auth.ts` login handler
    - After successful authentication, query `organizations` table using user's `organization_id`
    - Include `organization_name` field in the response user object
    - If organization record not found, complete login and omit `organization_name` from response
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 1.3 Write unit tests for Organization Name API endpoint
    - Test with valid auth and existing organization → returns correct name
    - Test with valid auth and non-existent organization → returns 404
    - Test with no auth token → returns 401
    - Test response time is within acceptable range
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.4 Write unit tests for enhanced login response
    - Test login response includes `organization_name` for valid org
    - Test login response omits `organization_name` for missing org
    - Test login still succeeds when organization record is missing
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 1.5 Write property test for Organization Name API correctness
    - **Property 1: Organization Name API returns correct name**
    - For any authenticated request where the JWT's `organization_id` corresponds to an existing record, the API returns the exact `name` value from that record
    - **Validates: Requirements 1.1**

  - [ ]* 1.6 Write property test for login response organization name
    - **Property 2: Login response includes correct organization name**
    - For any successful login where the user's `organization_id` maps to an existing organization record, the `organization_name` field equals the `name` column from the organizations table
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Admin Panel: State Management Enhancement
  - [x] 3.1 Extend AuthContext with organizationName state
    - Modify `frontend/src/context/AuthContext.tsx`
    - Add `organizationName: string | null` to the AuthState interface
    - On login, extract `organization_name` from the login response and store in state
    - Persist `organizationName` to `localStorage` under key `organizationName`
    - On logout, clear `organizationName` from both state and `localStorage`
    - On token refresh, retain the existing `organizationName` without re-fetching
    - Expose `organizationName` via `useAuth()` hook
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.2 Add fallback fetch from Organization Name API
    - If `organization_name` is missing from login response, fetch from `GET /api/organization/name`
    - On session restore from `localStorage`, restore cached `organizationName`
    - If cached value is missing during restore, fetch from the API endpoint
    - _Requirements: 5.1, 5.2_

  - [ ]* 3.3 Write unit tests for AuthContext organization name behavior
    - Test that login stores org name in state and localStorage
    - Test that logout clears org name from state and localStorage
    - Test that token refresh does not change stored org name
    - Test fallback fetch when login response omits org name
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.4 Write property test for Admin Panel state cleared on logout
    - **Property 3: Admin Panel state cleared on logout**
    - For any authenticated session with a stored organization name, after logout the organization name is null in both AuthContext and localStorage
    - **Validates: Requirements 5.3**

  - [ ]* 3.5 Write property test for token refresh preserving organization name
    - **Property 5: Token refresh preserves organization name**
    - For any stored organization name in AuthContext, a token refresh event leaves the organization name unchanged
    - **Validates: Requirements 5.4**

- [x] 4. Admin Panel: UI Components
  - [x] 4.1 Add organization name branding to the sidebar
    - Modify `frontend/src/layouts/AdminLayout.tsx`
    - Display the organization name below the application title in the sidebar header
    - Use a font size and color readable against the dark sidebar background
    - Show a skeleton/placeholder element while `organizationName` is loading (null)
    - Display "My School" as fallback if organization name fails to load
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Add organization name to dashboard heading
    - Modify `frontend/src/pages/admin/DashboardPage.tsx`
    - Replace static heading with `"{organizationName} Dashboard"`
    - Use a font size between 1.2rem and 2rem for the heading
    - Show a skeleton/loading indicator while name is loading
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.3 Create shared getDisplayName utility
    - Create or add to `frontend/src/utils/` a helper function
    - `getDisplayName(name: string | null | undefined): string` returns `name.trim()` or "My School" for null/undefined/empty/whitespace
    - Use this utility in both sidebar and dashboard components
    - _Requirements: 2.4, 3.1_

  - [ ]* 4.4 Write property test for fallback display logic
    - **Property 7: Fallback display returns "My School" for invalid names**
    - For any organization name that is null, undefined, empty string, or only whitespace, getDisplayName returns "My School"
    - **Validates: Requirements 2.4, 4.4**

  - [ ]* 4.5 Write unit tests for sidebar and dashboard branding
    - Test sidebar renders org name when available
    - Test sidebar shows skeleton while loading
    - Test sidebar shows "My School" fallback on error
    - Test dashboard heading includes org name
    - Test dashboard shows skeleton while loading
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 5. Checkpoint - Admin Panel complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Mobile App: State Management Enhancement
  - [x] 6.1 Extend Zustand auth store with organizationName
    - Modify `avento-mobile/src/stores/auth.ts`
    - Add `organizationName: string | null` to the auth state
    - On login, extract `organization_name` from login response and store in state
    - Persist `organizationName` in SecureStorage alongside the session object
    - On logout, clear `organizationName` from both Zustand state and SecureStorage
    - Expose via store selector: `useAuthStore(state => state.organizationName)`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.2 Implement session restore for organization name
    - On app launch session restore, read `organizationName` from the persisted session in SecureStorage
    - If cached value is available, set it in Zustand store without API call
    - If cached value is missing, fetch from `GET /api/organization/name` and update store + SecureStorage
    - _Requirements: 6.4, 6.5_

  - [x] 6.3 Add Organization Name API client function
    - Add a function in `avento-mobile/src/api/` to call `GET /api/organization/name`
    - Use the existing authenticated API client
    - Return the `organization_name` string or null on failure
    - _Requirements: 6.5_

  - [ ]* 6.4 Write unit tests for Zustand auth store organization name
    - Test login stores org name in state and SecureStorage
    - Test logout clears org name from state and SecureStorage
    - Test session restore reads org name from SecureStorage
    - Test fallback fetch when cached value is unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.5 Write property test for Mobile App state cleared on logout
    - **Property 4: Mobile App state cleared on logout**
    - For any authenticated session with a stored organization name, after logout the organization name is null in both Zustand store and SecureStorage
    - **Validates: Requirements 6.3**

  - [ ]* 6.6 Write property test for session restore recovering cached name
    - **Property 6: Session restore recovers cached organization name**
    - For any persisted session with a non-null organization name, restoreSession makes that same name available in the store without triggering an API call
    - **Validates: Requirements 6.4**

- [x] 7. Mobile App: UI Components
  - [x] 7.1 Add organization name to mobile dashboard screens
    - Modify Admin dashboard: `avento-mobile/src/screens/admin/DashboardScreen.tsx`
    - Modify Teacher dashboard (if separate screen exists)
    - Modify Parent/Stakeholder dashboard (if separate screen exists)
    - Display organization name prominently with minimum 18 scaled pixels font size
    - Show SkeletonLoader placeholder while name is loading
    - Display "My School" as fallback when name is unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Create shared getDisplayName utility for mobile
    - Add to `avento-mobile/src/` a helper function matching the same logic as Admin Panel
    - `getDisplayName(name: string | null | undefined): string` returns `name.trim()` or "My School"
    - _Requirements: 4.4_

  - [ ]* 7.3 Write unit tests for mobile dashboard branding
    - Test dashboard renders org name for each role (Admin, Teacher, Stakeholder)
    - Test skeleton displayed while loading
    - Test "My School" fallback shown on error
    - Test font size meets minimum 18sp requirement
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Final Checkpoint - All platforms complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `getDisplayName` utility is shared logic and should be consistent across Admin Panel and Mobile App
- No database schema changes are required — the feature reads the existing `organizations.name` column

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["3.1", "6.3"] },
    { "id": 3, "tasks": ["3.2", "6.1"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "4.3", "6.2", "7.2"] },
    { "id": 5, "tasks": ["4.1", "4.2", "6.4", "6.5", "6.6"] },
    { "id": 6, "tasks": ["4.4", "4.5", "7.1"] },
    { "id": 7, "tasks": ["7.3"] }
  ]
}
```
