# Implementation Plan: Custom Branding (Logo & Colors)

## Overview

Implement custom branding support allowing school Admins to set a logo URL and primary accent color for their organization. The branding is persisted in the existing `organizations.metadata` JSONB column, validated server-side, returned at login, and applied dynamically in both the Admin Panel (CSS custom properties) and Mobile App (themed colors). The implementation spans three layers: backend validation/API, web admin panel theming + settings UI, and React Native mobile theming.

## Tasks

- [x] 1. Backend branding validation and API extension
  - [x] 1.1 Create branding validation utility
    - Create `src/utils/brandingValidation.ts` with `validateBranding()` function
    - Implement HTTPS URL validation (well-formed, `https:` scheme only, max 2048 chars)
    - Implement `#RRGGBB` hex color validation via regex `/^#[0-9a-fA-F]{6}$/`
    - Export `BrandingInput` and `BrandingValidationResult` interfaces
    - Handle null/empty string as "clear" (skip validation, treat as valid)
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ]* 1.2 Write property tests for branding validation
    - **Property 4: Logo URL Validation Correctness**
    - **Property 5: Primary Color Validation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2**

  - [x] 1.3 Extend PUT /api/organization with branding validation and metadata merge
    - Import `validateBranding` in `src/routes/organization.ts`
    - Extract `logo_url` and `primary_color` from `req.body.metadata`
    - Call `validateBranding()` and return 400 with error details on failure
    - Implement read-modify-write pattern: read existing metadata, merge branding fields, preserve unrelated keys
    - Handle null/empty string clearing by deleting the key from metadata
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 2.5, 3.3, 3.4_

  - [ ]* 1.4 Write property test for metadata merge
    - **Property 2: Metadata Merge Preserves Unrelated Keys**
    - **Validates: Requirements 1.5**

  - [x] 1.5 Extend login response with branding fields
    - Modify `src/routes/auth.ts` POST /login handler to fetch `metadata` column alongside `name` from organizations table
    - Parse metadata JSON and attach `logo_url` and `primary_color` (or null) to `responseUser`
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]* 1.6 Write unit tests for backend branding
    - Test validation accepts valid HTTPS URLs and #RRGGBB colors
    - Test validation rejects non-HTTPS, too-long URLs, invalid color formats
    - Test null/empty clears are accepted without error
    - Test login response includes branding fields when metadata exists
    - Test login response returns null when metadata is empty
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.3, 4.4_

- [x] 2. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Admin Panel branding context and theming
  - [x] 3.1 Extend AuthContext with branding state
    - Add `logoUrl: string | null` and `primaryColor: string | null` to `AuthState` interface in `frontend/src/context/AuthContext.tsx`
    - Populate from login response (`response.data.user.logo_url`, `response.data.user.primary_color`)
    - Persist to localStorage (`brandingLogoUrl`, `brandingPrimaryColor`)
    - Add `updateBranding(logoUrl, primaryColor)` callback to context type and implementation
    - Restore branding from localStorage on mount and token refresh
    - Clear branding from localStorage on logout
    - _Requirements: 4.1, 5.5, 7.5_

  - [x] 3.2 Create BrandingProvider component
    - Create `frontend/src/context/BrandingProvider.tsx`
    - Read `primaryColor` from `useAuth()` context
    - Set CSS custom property `--brand-primary` on `document.documentElement` via `useEffect`
    - Default to `#2563eb` when `primaryColor` is null or undefined
    - Wrap inside the `AuthProvider` in the app component tree
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 3.3 Update AdminLayout sidebar to show organization logo
    - Modify `frontend/src/layouts/AdminLayout.tsx` to read `logoUrl` and `organizationName` from `useAuth()`
    - Conditionally render `<img>` when `logoUrl` is set and no load error occurred
    - Set `maxWidth: 140px`, `maxHeight: 48px`, `object-fit: contain` on logo image
    - Set `alt` attribute to organization name
    - Track image load errors in state; fall back to text title on error
    - Fall back to default text title when `logoUrl` is null
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.4 Write unit tests for Admin Panel branding
    - Test BrandingProvider sets `--brand-primary` CSS variable
    - Test fallback to `#2563eb` when primaryColor is null
    - Test logo image renders when logoUrl is provided
    - Test logo fallback to text title on load error
    - Test alt text matches organization name
    - _Requirements: 5.1, 5.4, 6.1, 6.3, 6.4, 6.5_

- [x] 4. Admin Panel branding settings UI
  - [x] 4.1 Create BrandingSettings page component
    - Create `frontend/src/pages/admin/BrandingSettings.tsx`
    - Add text input for Logo URL with label indicating HTTPS requirement
    - Add text input for Primary Color accepting `#RRGGBB` with a color preview swatch (background set to input value)
    - Add live logo preview (`<img>` that updates `src` on valid HTTPS URL input)
    - Initialize inputs from current branding values in AuthContext
    - On submit, send PUT to `/organization` with `{ metadata: { logo_url, primary_color } }`
    - Display field-level validation errors from API 400 response
    - Display success notification on save and call `updateBranding()` to apply immediately
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 4.2 Register BrandingSettings route and navigation
    - Add route entry for BrandingSettings page in the admin router/navigation
    - Add a link/menu item in the organization settings area accessible to Admin users
    - _Requirements: 9.1_

  - [ ]* 4.3 Write unit tests for BrandingSettings form
    - Test form submits correct payload to API
    - Test validation errors are displayed next to inputs
    - Test color preview swatch reflects input value
    - Test logo preview renders on valid HTTPS URL
    - Test success notification appears on save
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 5. Checkpoint - Admin Panel verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Mobile App branding integration
  - [x] 6.1 Add getThemedColors utility to theme module
    - Modify `avento-mobile/src/components/theme.ts` to export `getThemedColors(primaryOverride?: string | null)`
    - Return a merged colors object where `colors.primary` is replaced by `primaryOverride` when provided and valid
    - Default to `#2563eb` when override is null/undefined
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 6.2 Extend mobile auth store with branding state
    - Add `logoUrl: string | null` and `primaryColor: string | null` to `AuthState` type in `avento-mobile/src/types/auth.ts`
    - Update `useAuthStore` login action to extract `logo_url` and `primary_color` from login response user object
    - Persist branding fields in SecureStorage alongside session data
    - Restore branding from SecureStorage in `restoreSession`
    - Clear branding on logout (reset to null in LOGGED_OUT constant)
    - _Requirements: 7.1, 7.5_

  - [x] 6.3 Display organization logo on mobile dashboard screens
    - Modify dashboard screens (`avento-mobile/src/screens/admin/DashboardScreen.tsx` and other role dashboards) to read `logoUrl` from `useAuthStore`
    - Conditionally render `<Image>` with `maxWidth: 120`, `maxHeight: 40`, `resizeMode: 'contain'`
    - Track image load errors; hide element gracefully on failure (no broken image indicator)
    - Do not render image element when `logoUrl` is null
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.4 Write unit tests for mobile branding
    - Test `getThemedColors` returns override color when provided
    - Test `getThemedColors` returns default `#2563eb` when null
    - Test auth store populates branding on login
    - Test auth store clears branding on logout
    - Test dashboard hides logo when `logoUrl` is null
    - _Requirements: 7.1, 7.4, 7.5, 8.3_

- [x] 7. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- No database migration needed — branding uses existing `organizations.metadata` JSONB column
- Default primary color across all platforms is `#2563eb`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["1.6", "3.1", "6.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "6.2"] },
    { "id": 5, "tasks": ["3.4", "4.1", "6.3"] },
    { "id": 6, "tasks": ["4.2", "4.3", "6.4"] }
  ]
}
```
