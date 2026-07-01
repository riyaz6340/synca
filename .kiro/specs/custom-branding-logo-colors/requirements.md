# Requirements Document

## Introduction

This feature extends the existing organization branding capabilities by allowing school Admins to upload a custom logo (via externally-hosted URL) and set a primary brand color (hex code). The branding values are persisted in the existing `organizations.metadata` JSONB column and applied dynamically across the Admin Panel (CSS custom properties) and Mobile App (dynamic style objects). The existing `PUT /api/organization` endpoint is extended to accept and validate logo URL and primary color fields.

## Glossary

- **Organization**: A school or institution record in the `organizations` table, identified by a UUID `id`, a `name` field, and a `metadata` JSONB column.
- **Admin_Panel**: The React/Vite web application located at `frontend/`, used by Admin and Teacher roles.
- **Mobile_App**: The React Native/Expo application located at `avento-mobile/`, used by Admin, Teacher, and Stakeholder roles.
- **Branding_API**: The existing `PUT /api/organization` endpoint extended to accept `metadata.logo_url` and `metadata.primary_color` fields.
- **Branding_Settings**: The combination of `logo_url` and `primary_color` stored within `organizations.metadata` JSONB.
- **Logo_URL**: An externally-hosted HTTPS URL pointing to an image file (PNG, JPEG, SVG, or WebP) used as the organization logo.
- **Primary_Color**: A 7-character hexadecimal color string in `#RRGGBB` format representing the organization accent color.
- **CSS_Custom_Properties**: CSS variables (e.g., `--brand-primary`) set on the document root to enable dynamic theming in the Admin Panel.
- **Theme_Context**: The mechanism (React Context or equivalent) that provides branding values to Admin Panel components for CSS custom property injection.
- **Auth_Store**: The Zustand store in the Mobile App that holds session state and branding data.

## Requirements

### Requirement 1: Branding Data Persistence via API

**User Story:** As a school Admin, I want to save a custom logo URL and primary color for my organization, so that the branding is stored and available across all platforms.

#### Acceptance Criteria

1. WHEN an Admin submits a PUT request to the Branding_API with a valid `metadata.logo_url` field, THE Branding_API SHALL store the Logo_URL value in the `organizations.metadata` JSONB column.
2. WHEN an Admin submits a PUT request to the Branding_API with a valid `metadata.primary_color` field, THE Branding_API SHALL store the Primary_Color value in the `organizations.metadata` JSONB column.
3. THE Branding_API SHALL require the `authenticate`, `tenantIsolation`, and `authorize('Admin')` middleware before processing branding updates.
4. WHEN a non-Admin user submits a PUT request to the Branding_API, THE Branding_API SHALL return a 403 status with an error message.
5. THE Branding_API SHALL merge new metadata fields with existing metadata values without overwriting unrelated metadata keys.

### Requirement 2: Logo URL Validation

**User Story:** As a school Admin, I want the system to validate my logo URL before saving, so that invalid or unsafe URLs are rejected.

#### Acceptance Criteria

1. WHEN the Branding_API receives a `metadata.logo_url` value, THE Branding_API SHALL validate that the value is a well-formed URL with an HTTPS scheme.
2. WHEN the Branding_API receives a `metadata.logo_url` value with a non-HTTPS scheme, THE Branding_API SHALL return a 400 status with a descriptive validation error.
3. WHEN the Branding_API receives a `metadata.logo_url` value that exceeds 2048 characters in length, THE Branding_API SHALL return a 400 status with a descriptive validation error.
4. WHEN the Branding_API receives a `metadata.logo_url` value of empty string, THE Branding_API SHALL clear the stored logo URL from metadata.
5. WHEN the Branding_API receives a `metadata.logo_url` value of null, THE Branding_API SHALL clear the stored logo URL from metadata.

### Requirement 3: Primary Color Validation

**User Story:** As a school Admin, I want the system to validate my chosen color before saving, so that only valid hex colors are accepted.

#### Acceptance Criteria

1. WHEN the Branding_API receives a `metadata.primary_color` value, THE Branding_API SHALL validate that the value matches the pattern `#RRGGBB` (a hash followed by exactly six hexadecimal characters).
2. WHEN the Branding_API receives a `metadata.primary_color` value that does not match the `#RRGGBB` pattern, THE Branding_API SHALL return a 400 status with a descriptive validation error.
3. WHEN the Branding_API receives a `metadata.primary_color` value of empty string, THE Branding_API SHALL clear the stored primary color from metadata.
4. WHEN the Branding_API receives a `metadata.primary_color` value of null, THE Branding_API SHALL clear the stored primary color from metadata.

### Requirement 4: Branding Data Retrieval

**User Story:** As a frontend client, I want to retrieve the organization branding data on login and session restore, so that the UI reflects the custom branding immediately.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE backend login endpoint SHALL include `logo_url` and `primary_color` from the organization metadata in the response.
2. WHEN an authenticated request is made to the existing `GET /api/organization` endpoint, THE endpoint SHALL include the `metadata` object containing `logo_url` and `primary_color` in the response.
3. IF the organization metadata does not contain `logo_url`, THEN THE backend SHALL return `logo_url` as null in the response.
4. IF the organization metadata does not contain `primary_color`, THEN THE backend SHALL return `primary_color` as null in the response.

### Requirement 5: Admin Panel Dynamic Theming

**User Story:** As a school Admin or Teacher, I want to see my organization's brand color applied throughout the Admin Panel, so that the interface feels personalized to my school.

#### Acceptance Criteria

1. WHEN branding data is loaded in the Admin_Panel, THE Admin_Panel SHALL set a CSS custom property `--brand-primary` on the document root element with the Primary_Color value.
2. THE Admin_Panel sidebar active-link highlight, buttons with primary styling, and section headings SHALL use the `--brand-primary` CSS custom property for their accent color.
3. WHILE branding data is loading in the Admin_Panel, THE Admin_Panel SHALL use the default primary color value `#2563eb` for themed elements.
4. IF the Primary_Color value is null or not set, THEN THE Admin_Panel SHALL use the default primary color value `#2563eb` for the `--brand-primary` CSS custom property.
5. WHEN the Primary_Color value changes (after an Admin saves new branding), THE Admin_Panel SHALL update the `--brand-primary` CSS custom property without requiring a page reload.

### Requirement 6: Admin Panel Logo Display

**User Story:** As a school Admin or Teacher, I want to see my school logo in the sidebar, so that the Admin Panel feels branded to my institution.

#### Acceptance Criteria

1. WHEN a valid Logo_URL is available in the branding data, THE Admin_Panel SHALL display the logo image in the sidebar header area.
2. THE Admin_Panel SHALL render the logo image with a maximum width of 140 pixels and a maximum height of 48 pixels to fit within the sidebar header.
3. IF the Logo_URL is null or not set, THEN THE Admin_Panel SHALL display the default text-based application title in the sidebar header.
4. IF the logo image fails to load (network error or broken URL), THEN THE Admin_Panel SHALL fall back to displaying the default text-based application title.
5. THE Admin_Panel SHALL set the `alt` attribute on the logo image element to the organization name for accessibility.

### Requirement 7: Mobile App Dynamic Theming

**User Story:** As a mobile user (Admin, Teacher, or Stakeholder), I want to see my school's brand color applied in the app, so that it feels personalized.

#### Acceptance Criteria

1. WHEN branding data is loaded in the Mobile_App, THE Mobile_App SHALL override the static `colors.primary` value in the theme with the Primary_Color value.
2. THE Mobile_App navigation header, action buttons, and status indicators using `colors.primary` SHALL reflect the overridden Primary_Color value.
3. WHILE branding data is loading in the Mobile_App, THE Mobile_App SHALL use the default primary color value `#2563eb` for themed elements.
4. IF the Primary_Color value is null or not set, THEN THE Mobile_App SHALL use the default primary color value `#2563eb`.
5. WHEN the user logs out of the Mobile_App, THE Auth_Store SHALL clear the cached branding data from secure storage and memory.

### Requirement 8: Mobile App Logo Display

**User Story:** As a mobile user, I want to see my school logo on the dashboard, so that the app feels connected to my school.

#### Acceptance Criteria

1. WHEN a valid Logo_URL is available in the branding data, THE Mobile_App SHALL display the logo image on the dashboard screen.
2. THE Mobile_App SHALL render the logo image with a maximum width of 120 scaled pixels and a maximum height of 40 scaled pixels.
3. IF the Logo_URL is null or not set, THEN THE Mobile_App SHALL not render a logo image element on the dashboard.
4. IF the logo image fails to load (network error or broken URL), THEN THE Mobile_App SHALL hide the logo image element gracefully without displaying a broken image indicator.

### Requirement 9: Admin Panel Branding Settings UI

**User Story:** As a school Admin, I want a settings interface to input my logo URL and primary color, so that I can customize my organization's branding.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a branding settings section accessible to Admin users within the organization settings area.
2. THE Admin_Panel branding settings SHALL include a text input field for the Logo_URL with a label indicating HTTPS URLs are required.
3. THE Admin_Panel branding settings SHALL include a text input field for the Primary_Color that accepts a `#RRGGBB` hex value.
4. THE Admin_Panel branding settings SHALL display a color preview swatch next to the Primary_Color input showing the entered color.
5. WHEN the Admin submits the branding settings form, THE Admin_Panel SHALL send a PUT request to the Branding_API with the entered values.
6. WHEN the Branding_API returns a validation error, THE Admin_Panel SHALL display the error message next to the corresponding input field.
7. WHEN the Branding_API returns a success response, THE Admin_Panel SHALL display a success notification and update the active branding immediately.
8. THE Admin_Panel branding settings SHALL display a live preview of the logo image when a valid HTTPS URL is entered in the Logo_URL field.
