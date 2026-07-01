# Requirements Document

## Introduction

This feature personalizes the user experience by prominently displaying the school/organization name on dashboard screens and navigation elements across both the Admin Panel (React/Vite web app) and the Mobile App (React Native/Expo). When any user (Admin, Teacher, or Stakeholder/Parent) logs in, their associated organization name is resolved from the backend and made visible in the UI, creating a branded, personalized feel for each school.

## Glossary

- **Organization**: A school or institution record in the `organizations` table, identified by a UUID `id` and a `name` field.
- **Admin_Panel**: The React/Vite web application located at `frontend/`, used by Admin and Teacher roles.
- **Mobile_App**: The React Native/Expo application located at `avento-mobile/`, used by Admin, Teacher, and Stakeholder roles.
- **Dashboard**: The primary landing screen shown after authentication in both the Admin Panel and Mobile App.
- **Sidebar**: The persistent vertical navigation panel in the Admin Panel layout.
- **Organization_Name_API**: A backend endpoint that returns the organization name for the authenticated user's organization.
- **Auth_Context**: The frontend authentication context (React Context in Admin Panel, Zustand store in Mobile App) that holds session state.
- **JWT**: The JSON Web Token issued at login containing `user_id`, `organization_id`, and `role` claims.

## Requirements

### Requirement 1: Backend Organization Name Resolution

**User Story:** As a frontend client, I want an API endpoint that returns my organization's name, so that I can display it in the UI without embedding it in the JWT.

#### Acceptance Criteria

1. WHEN an authenticated request is made to the Organization_Name_API, THE Organization_Name_API SHALL return the organization name corresponding to the `organization_id` from the JWT.
2. WHEN an authenticated request is made to the Organization_Name_API, THE Organization_Name_API SHALL return the response within 200ms under normal database load.
3. IF the `organization_id` in the JWT does not match any record in the organizations table, THEN THE Organization_Name_API SHALL return a 404 status with a descriptive error message.
4. THE Organization_Name_API SHALL require a valid authentication token before processing the request.

### Requirement 2: Admin Panel Sidebar Branding

**User Story:** As a school Admin or Teacher, I want to see my school name in the sidebar, so that I know I am managing the correct organization.

#### Acceptance Criteria

1. WHEN the Admin_Panel sidebar renders, THE Admin_Panel SHALL display the Organization name in the sidebar header area below the application title.
2. THE Admin_Panel SHALL display the Organization name using a font size and color that is readable against the dark sidebar background.
3. WHILE the Organization name is loading, THE Admin_Panel SHALL display a placeholder or skeleton element in the sidebar header area.
4. IF the Organization name fails to load, THEN THE Admin_Panel SHALL display the text "My School" as a fallback in the sidebar header area.

### Requirement 3: Admin Panel Dashboard Branding

**User Story:** As a school Admin or Teacher, I want to see my school name on the dashboard, so that the experience feels branded to my institution.

#### Acceptance Criteria

1. WHEN the Admin_Panel Dashboard renders, THE Admin_Panel SHALL display the Organization name as part of the dashboard heading.
2. THE Admin_Panel SHALL display the Organization name in the dashboard heading with a font size between 1.2rem and 2rem.
3. WHILE the Organization name is loading on the Dashboard, THE Admin_Panel SHALL display a loading indicator or skeleton in the heading area.

### Requirement 4: Mobile App Dashboard Branding

**User Story:** As a mobile user (Admin, Teacher, or Stakeholder), I want to see my school name on the mobile dashboard, so that the app feels personalized to my school.

#### Acceptance Criteria

1. WHEN the Mobile_App dashboard screen renders for any authenticated role (Admin, Teacher, Stakeholder), THE Mobile_App SHALL display the Organization name prominently on the dashboard screen.
2. THE Mobile_App SHALL display the Organization name with a minimum font size of 18 scaled pixels.
3. WHILE the Organization name is loading, THE Mobile_App SHALL display a placeholder skeleton element on the dashboard.
4. IF the Organization name fails to load, THEN THE Mobile_App SHALL display the text "My School" as a fallback on the dashboard.

### Requirement 5: Organization Name State Management (Admin Panel)

**User Story:** As a frontend developer, I want the organization name available through the Auth Context, so that any component can access it without redundant API calls.

#### Acceptance Criteria

1. WHEN a user successfully authenticates in the Admin_Panel, THE Auth_Context SHALL fetch and store the Organization name.
2. THE Auth_Context SHALL make the Organization name available to all child components via the context value.
3. WHEN the user logs out of the Admin_Panel, THE Auth_Context SHALL clear the stored Organization name from memory and local storage.
4. WHEN a token refresh occurs in the Admin_Panel, THE Auth_Context SHALL retain the previously fetched Organization name without re-fetching.

### Requirement 6: Organization Name State Management (Mobile App)

**User Story:** As a mobile developer, I want the organization name stored in the auth Zustand store, so that all screens can display it without extra network calls.

#### Acceptance Criteria

1. WHEN a user successfully authenticates in the Mobile_App, THE Mobile_App auth store SHALL fetch and store the Organization name.
2. THE Mobile_App auth store SHALL make the Organization name accessible to all screens and components via the store selector.
3. WHEN the user logs out of the Mobile_App, THE Mobile_App auth store SHALL clear the stored Organization name from secure storage and memory.
4. WHEN a session is restored on app launch in the Mobile_App, THE Mobile_App auth store SHALL also restore the cached Organization name from secure storage.
5. IF the cached Organization name is unavailable during session restore, THEN THE Mobile_App auth store SHALL fetch the Organization name from the Organization_Name_API.

### Requirement 7: Login Response Enhancement

**User Story:** As a frontend client, I want the login response to include the organization name, so that the name is available immediately after login without a separate API call.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE backend login endpoint SHALL include the `organization_name` field in the response user object.
2. THE backend login endpoint SHALL resolve the organization name by querying the organizations table using the user's `organization_id`.
3. IF the organization record cannot be found during login, THEN THE backend login endpoint SHALL still complete the login and omit the `organization_name` field from the response.
