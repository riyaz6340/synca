# Design Document: Custom Branding (Logo & Colors)

## Overview

This feature extends the existing organization management infrastructure to support custom branding — a logo URL and primary accent color — that is persisted via the existing `PUT /api/organization` endpoint and propagated to the Admin Panel (CSS custom properties) and Mobile App (dynamic theme overrides) at login and on update.

The design leverages the existing `organizations.metadata` JSONB column, the `AuthContext` in the Admin Panel, and the Zustand `useAuthStore` in the Mobile App, minimizing new infrastructure while ensuring branding values flow consistently across all platforms.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Backend (Express)                       │
│                                                                │
│  PUT /api/organization  ──► validateBranding() ──► DB merge   │
│  POST /auth/login       ──► attach branding to response       │
│  GET /api/organization  ──► return metadata with branding     │
└──────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐     ┌─────────────────────────┐
│   Admin Panel (Web)  │     │   Mobile App (Expo/RN)   │
│                      │     │                          │
│ AuthContext          │     │ useAuthStore             │
│   ├─ logoUrl         │     │   ├─ logoUrl             │
│   ├─ primaryColor    │     │   ├─ primaryColor        │
│   └─ setBranding()   │     │   └─ (persisted in SS)   │
│                      │     │                          │
│ BrandingProvider     │     │ getThemedColors()        │
│   └─ sets --brand-   │     │   └─ returns merged      │
│      primary on :root│     │      colors object       │
│                      │     │                          │
│ BrandingSettings page│     │ Dashboard logo display   │
└─────────────────────┘     └─────────────────────────┘
```

## Components and Interfaces

### 1. Backend — Branding Validation Module

**File:** `src/utils/brandingValidation.ts`

A pure validation module that validates `logo_url` and `primary_color` fields before persistence.

```typescript
export interface BrandingValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export interface BrandingInput {
  logo_url?: string | null;
  primary_color?: string | null;
}

const LOGO_URL_MAX_LENGTH = 2048;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function validateBranding(input: BrandingInput): BrandingValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (input.logo_url !== undefined && input.logo_url !== null && input.logo_url !== '') {
    try {
      const url = new URL(input.logo_url);
      if (url.protocol !== 'https:') {
        errors.push({ field: 'logo_url', message: 'Logo URL must use HTTPS scheme' });
      }
    } catch {
      errors.push({ field: 'logo_url', message: 'Logo URL must be a valid URL' });
    }
    if (input.logo_url.length > LOGO_URL_MAX_LENGTH) {
      errors.push({ field: 'logo_url', message: `Logo URL must not exceed ${LOGO_URL_MAX_LENGTH} characters` });
    }
  }

  if (input.primary_color !== undefined && input.primary_color !== null && input.primary_color !== '') {
    if (!HEX_COLOR_REGEX.test(input.primary_color)) {
      errors.push({ field: 'primary_color', message: 'Primary color must be in #RRGGBB format' });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### 2. Backend — Enhanced Organization Route

**File:** `src/routes/organization.ts` (modified)

The existing `PUT /` handler is extended to:
1. Extract `logo_url` and `primary_color` from `req.body.metadata`
2. Validate via `validateBranding()`
3. Merge into existing metadata (preserving unrelated keys) using a read-modify-write pattern

```typescript
// Inside PUT / handler, before DB update:
if (metadata !== undefined) {
  const brandingInput: BrandingInput = {
    logo_url: metadata.logo_url,
    primary_color: metadata.primary_color,
  };

  // Only validate if branding fields are present
  if (brandingInput.logo_url !== undefined || brandingInput.primary_color !== undefined) {
    const validation = validateBranding(brandingInput);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', details: validation.errors });
      return;
    }
  }

  // Read existing metadata to merge (preserve unrelated keys)
  const existing = await db('organizations')
    .select('metadata')
    .where({ id: req.organizationId })
    .first();

  const existingMetadata = existing?.metadata ?? {};
  const mergedMetadata = { ...existingMetadata };

  // Handle logo_url: null/empty clears, string sets
  if (metadata.logo_url === null || metadata.logo_url === '') {
    delete mergedMetadata.logo_url;
  } else if (metadata.logo_url !== undefined) {
    mergedMetadata.logo_url = metadata.logo_url;
  }

  // Handle primary_color: null/empty clears, string sets
  if (metadata.primary_color === null || metadata.primary_color === '') {
    delete mergedMetadata.primary_color;
  } else if (metadata.primary_color !== undefined) {
    mergedMetadata.primary_color = metadata.primary_color;
  }

  updates.metadata = JSON.stringify(mergedMetadata);
}
```

### 3. Backend — Enhanced Login Response

**File:** `src/routes/auth.ts` (modified)

The login handler fetches the organization's full record (including `metadata`) and attaches `logo_url` and `primary_color` to the response.

```typescript
// Replace the existing organization name fetch with:
const organization = await db('organizations')
  .select('name', 'metadata')
  .where({ id: user.organization_id })
  .first();

// In responseUser construction:
if (organization) {
  responseUser.organization_name = organization.name;
  const meta = typeof organization.metadata === 'string'
    ? JSON.parse(organization.metadata)
    : organization.metadata ?? {};
  responseUser.logo_url = meta.logo_url ?? null;
  responseUser.primary_color = meta.primary_color ?? null;
}
```

### 4. Admin Panel — AuthContext Extension

**File:** `frontend/src/context/AuthContext.tsx` (modified)

Add `logoUrl` and `primaryColor` to `AuthState` and populate from login response and organization fetch.

```typescript
interface AuthState {
  // ... existing fields
  logoUrl: string | null;
  primaryColor: string | null;
}

// In login callback, after receiving response:
const logoUrl = response.data.user.logo_url ?? null;
const primaryColor = response.data.user.primary_color ?? null;
localStorage.setItem('brandingLogoUrl', logoUrl ?? '');
localStorage.setItem('brandingPrimaryColor', primaryColor ?? '');
setState(prev => ({ ...prev, logoUrl, primaryColor }));

// Add a method to update branding in-place (after admin saves):
const updateBranding = useCallback((logoUrl: string | null, primaryColor: string | null) => {
  localStorage.setItem('brandingLogoUrl', logoUrl ?? '');
  localStorage.setItem('brandingPrimaryColor', primaryColor ?? '');
  setState(prev => ({ ...prev, logoUrl, primaryColor }));
}, []);
```

### 5. Admin Panel — BrandingProvider

**File:** `frontend/src/context/BrandingProvider.tsx` (new)

A component that reads branding from `AuthContext` and injects CSS custom properties on the document root.

```typescript
import { useEffect } from 'react';
import { useAuth } from './AuthContext';

const DEFAULT_PRIMARY = '#2563eb';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { primaryColor } = useAuth();

  useEffect(() => {
    const color = primaryColor ?? DEFAULT_PRIMARY;
    document.documentElement.style.setProperty('--brand-primary', color);
  }, [primaryColor]);

  return <>{children}</>;
}
```

### 6. Admin Panel — BrandingSettings Page

**File:** `frontend/src/pages/admin/BrandingSettings.tsx` (new)

A settings form accessible to Admin users for entering logo URL and primary color.

```typescript
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

export default function BrandingSettings() {
  const { logoUrl, primaryColor, updateBranding } = useAuth();
  const [logoInput, setLogoInput] = useState(logoUrl ?? '');
  const [colorInput, setColorInput] = useState(primaryColor ?? '#2563eb');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);

    try {
      await apiClient.put('/organization', {
        metadata: {
          logo_url: logoInput || null,
          primary_color: colorInput || null,
        },
      });
      updateBranding(logoInput || null, colorInput || null);
      setSuccess(true);
    } catch (err: any) {
      if (err.response?.data?.details) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of err.response.data.details) {
          fieldErrors[detail.field] = detail.message;
        }
        setErrors(fieldErrors);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Logo URL input with HTTPS hint label */}
      {/* Color input with preview swatch */}
      {/* Live logo preview when valid HTTPS URL entered */}
      {/* Submit button, error/success feedback */}
    </form>
  );
}
```

### 7. Admin Panel — Sidebar Logo

**File:** `frontend/src/layouts/AdminLayout.tsx` (modified)

Conditionally render an `<img>` or the text title based on `logoUrl` availability.

```typescript
const { logoUrl, organizationName } = useAuth();
const [logoError, setLogoError] = useState(false);

// In sidebar header:
{logoUrl && !logoError ? (
  <img
    src={logoUrl}
    alt={organizationName ?? 'Organization logo'}
    style={{ maxWidth: 140, maxHeight: 48, objectFit: 'contain' }}
    onError={() => setLogoError(true)}
  />
) : (
  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Avento</h2>
)}
```

### 8. Mobile App — Theme Resolution

**File:** `avento-mobile/src/components/theme.ts` (modified)

Export a function that produces a themed colors object given an optional brand color override.

```typescript
const DEFAULT_PRIMARY = '#2563eb';

export function getThemedColors(primaryOverride?: string | null) {
  const primary = primaryOverride ?? DEFAULT_PRIMARY;
  return {
    ...colors,
    primary,
  };
}
```

### 9. Mobile App — Auth Store Extension

**File:** `avento-mobile/src/stores/auth.ts` (modified)

Add `logoUrl` and `primaryColor` to the store state and persist in SecureStorage alongside the session.

```typescript
// In AuthState type (types/auth.ts):
interface AuthState {
  // ... existing fields
  logoUrl: string | null;
  primaryColor: string | null;
}

// In login action, after receiving response:
const logoUrl = user.logo_url ?? null;
const primaryColor = user.primary_color ?? null;

await secureStorage.saveSession({
  token, user, biometricEnabled: false,
  organizationName: organizationName ?? undefined,
  logoUrl: logoUrl ?? undefined,
  primaryColor: primaryColor ?? undefined,
});

set({ ...state, logoUrl, primaryColor });

// In clearLocalSession (logout):
// Already clears SecureStorage and AsyncStorage, which removes branding.
// Reset in-memory:
const LOGGED_OUT = {
  // ... existing
  logoUrl: null,
  primaryColor: null,
} as const;
```

### 10. Mobile App — Dashboard Logo

**File:** `avento-mobile/src/screens/DashboardScreen.tsx` (modified)

Conditionally render the logo image using the stored `logoUrl`.

```typescript
import { Image } from 'react-native';
import useAuthStore from '@/stores/auth';

const { logoUrl } = useAuthStore();
const [logoVisible, setLogoVisible] = useState(true);

// In render:
{logoUrl && logoVisible && (
  <Image
    source={{ uri: logoUrl }}
    style={{ maxWidth: 120, maxHeight: 40, resizeMode: 'contain' }}
    onError={() => setLogoVisible(false)}
    accessible={true}
    accessibilityLabel="Organization logo"
  />
)}
```

## Interfaces (API Contracts)

### API Request — PUT /api/organization (branding fields)

```typescript
interface OrganizationUpdateRequest {
  name?: string;
  industry_module?: string;
  metadata?: {
    logo_url?: string | null;       // HTTPS URL, max 2048 chars, null/empty to clear
    primary_color?: string | null;  // #RRGGBB format, null/empty to clear
    [key: string]: unknown;         // other metadata preserved
  };
}
```

### API Response — POST /auth/login (extended)

```typescript
interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'Admin' | 'Stakeholder' | 'SuperAdmin' | 'Teacher';
    organization_id: string;
    organization_name?: string;
    logo_url: string | null;       // NEW
    primary_color: string | null;  // NEW
  };
}
```

### API Response — PUT /api/organization (error)

```typescript
interface ValidationErrorResponse {
  error: 'Validation failed';
  details: Array<{ field: string; message: string }>;
}
```

### Frontend AuthState Extension

```typescript
interface AuthState {
  // existing
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  teacherContext: TeacherContext | null;
  organizationName: string | null;
  // new
  logoUrl: string | null;
  primaryColor: string | null;
}
```

### Mobile AuthState Extension

```typescript
interface AuthState {
  // existing
  token: string | null;
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  organizationName: string | null;
  // new
  logoUrl: string | null;
  primaryColor: string | null;
}
```

## Data Models

No schema migrations are required. The existing `organizations.metadata` JSONB column stores branding fields:

```json
{
  "logo_url": "https://example.com/school-logo.png",
  "primary_color": "#1a73e8",
  "...other_existing_keys": "preserved"
}
```

**Constraints enforced at application level:**
- `logo_url`: valid HTTPS URL, max 2048 characters
- `primary_color`: matches `/^#[0-9a-fA-F]{6}$/`

## Error Handling

| Scenario | Layer | Behavior |
|----------|-------|----------|
| Invalid logo URL format | Backend | 400 + validation error details |
| Non-HTTPS logo URL | Backend | 400 + descriptive message |
| Logo URL > 2048 chars | Backend | 400 + descriptive message |
| Invalid hex color | Backend | 400 + descriptive message |
| Non-Admin PUT attempt | Backend | 403 via `authorize('Admin')` middleware |
| Logo image load failure | Admin Panel | Fall back to text title, hide broken image |
| Logo image load failure | Mobile App | Hide image element gracefully |
| Null/missing branding | All clients | Use default `#2563eb` for color, no logo rendered |

## Testing Strategy

**Unit Tests (example-based):**
- Middleware wiring (authorize, authenticate, tenantIsolation) on PUT /api/organization
- Clearing behavior for null/empty logo_url and primary_color
- Login response fields when metadata is missing
- Admin Panel logo fallback on image load error
- Admin Panel default color while loading
- Mobile App logo hide on load error
- Branding settings form submission and error display
- Logout clears branding from auth store

**Property-Based Tests:**
- Branding validation functions (logo URL and primary color) across generated inputs
- Metadata merge preserves unrelated keys for arbitrary metadata shapes
- Theme resolution always returns a valid color (override or default)
- Round-trip: store then retrieve branding yields identical values
- Non-Admin roles always receive 403

**Integration Tests:**
- Full PUT → GET flow with real database
- Login flow returns branding fields end-to-end
- Admin Panel renders correct CSS variable after branding update

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Branding Persistence Round-Trip

For any valid logo URL (well-formed HTTPS, ≤ 2048 chars) and any valid primary color (matching `#RRGGBB`), storing them via `PUT /api/organization` and then retrieving via `GET /api/organization` SHALL return the same values that were submitted.

**Validates: Requirements 1.1, 1.2, 4.2**

### Property 2: Metadata Merge Preserves Unrelated Keys

For any existing organization metadata containing arbitrary keys, and any branding update (logo_url and/or primary_color), all metadata keys not named `logo_url` or `primary_color` SHALL remain unchanged after the update.

**Validates: Requirements 1.5**

### Property 3: Non-Admin Authorization Rejection

For any user with a role other than 'Admin' (Stakeholder, Teacher, SuperAdmin-without-admin-on-org), a PUT request to the Branding_API SHALL return a 403 status code regardless of the request body content.

**Validates: Requirements 1.4**

### Property 4: Logo URL Validation Correctness

For any string value submitted as `metadata.logo_url`, the validation SHALL accept the value if and only if it is a well-formed URL with the `https:` protocol and does not exceed 2048 characters in length. All other non-empty, non-null strings SHALL be rejected with a 400 status.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Primary Color Validation Correctness

For any string value submitted as `metadata.primary_color`, the validation SHALL accept the value if and only if it matches the regular expression `/^#[0-9a-fA-F]{6}$/`. All other non-empty, non-null strings SHALL be rejected with a 400 status.

**Validates: Requirements 3.1, 3.2**

### Property 6: Login Response Includes Branding

For any organization with metadata containing `logo_url` and/or `primary_color`, when any user in that organization successfully logs in, the login response SHALL include the exact `logo_url` and `primary_color` values from the organization's metadata. When metadata fields are absent, the response SHALL include them as `null`.

**Validates: Requirements 4.1, 4.3, 4.4**

### Property 7: Theme Resolution Fallback

For any `primaryColor` value (including `null` and `undefined`), the resolved theme color SHALL equal `primaryColor` when it is a valid hex string, or the default `#2563eb` otherwise. This applies to both the Admin Panel CSS custom property `--brand-primary` and the Mobile App `getThemedColors()` return value.

**Validates: Requirements 5.1, 5.4, 7.1, 7.4**

### Property 8: Branding Settings Preview Reflects Input

For any valid `#RRGGBB` hex color entered in the branding settings color input, the preview swatch background color SHALL equal that hex value. For any valid HTTPS URL entered in the logo URL input, the preview image `src` attribute SHALL equal that URL.

**Validates: Requirements 9.4, 9.8**

### Property 9: Logo Alt Text Matches Organization Name

For any organization with a non-null `logoUrl`, the rendered logo image `alt` attribute in the Admin Panel SHALL equal the organization's name.

**Validates: Requirements 6.5**
