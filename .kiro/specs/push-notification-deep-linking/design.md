# Design Document: Push Notification Deep-Linking for Leave Notifications

## Overview

This design extends the existing push-notification deep-linking infrastructure to handle leave-related notification types (`leave_approved`, `leave_rejected`, `admin_leave_pending`) with role-aware routing. The architecture preserves the existing decoupled pattern: `resolveNavigationTarget` remains a pure mapping function, and `nestedRouteFor` gains role-awareness by reading the user's role from the Zustand auth store at dispatch time.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Backend API                                 │
│  Sends push with data: { type, leave_id, person_id, org_id }     │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ FCM / APNs
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   expo-notifications                               │
│  Delivers to handleNotificationTapped (bg/fg)                     │
│  or getLastNotificationResponseAsync (cold-start)                 │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ NotificationResponse
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│            pushNotifications.ts (Push_Service)                     │
│                                                                    │
│  resolveNavigationTarget(data) → NavigationTarget | null          │
│    • Existing: attendance → AttendanceHistory                     │
│    • Existing: announcement → AnnouncementDetail                  │
│    • NEW: leave_approved → LeaveList { leaveId, personId? }       │
│    • NEW: leave_rejected → LeaveList { leaveId, personId? }       │
│    • NEW: admin_leave_pending → LeaveManagement { leaveId, ... }  │
│                                                                    │
│  handleNotificationTapped → calls navigationHandler(target)       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ NavigationTarget
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│            navigationRef.ts (Navigation_Ref / Role_Router)         │
│                                                                    │
│  navigateToTarget(target)                                         │
│    → nestedRouteFor(target, role)                                 │
│      • LeaveList + Stakeholder → ParentTabs > Leave > LeaveList   │
│      • LeaveManagement + Admin → AdminTabs > Management > ...     │
│      • LeaveManagement + SuperAdmin → SuperAdminTabs > ...        │
│      • LeaveManagement + Teacher → TeacherTabs > TeacherLeave     │
│      • null/unknown role → ParentTabs fallback                    │
│    → navigationRef.navigate(nested)                               │
└──────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Push Service Extension (`src/services/pushNotifications.ts`)

The `resolveNavigationTarget` function gains three new cases in its `switch` statement. The mapping remains pure (no side effects, no auth store access) — it translates payload fields to a flat `NavigationTarget`.

**New notification types handled:**

| Payload `type`        | Resolved `screen`   | Params                                      |
|-----------------------|---------------------|---------------------------------------------|
| `leave_approved`      | `LeaveList`         | `{ leaveId, personId? }`                    |
| `leave_rejected`      | `LeaveList`         | `{ leaveId, personId? }`                    |
| `admin_leave_pending` | `LeaveManagement`   | `{ leaveId, personId?, organizationId? }`   |

**Validation rules:**
- If `leaveId` / `leave_id` is missing → return `null`
- If `person_id` is present → include as `personId`
- If `organization_id` is present → include as `organizationId`

#### Extended `resolveNavigationTarget`

```typescript
/**
 * Pure mapping from a notification data payload to a navigation target.
 * Returns null for unknown/malformed payloads.
 */
export function resolveNavigationTarget(
  data: Record<string, unknown> | undefined | null,
): NavigationTarget | null;
```

**New cases within the function:**

```typescript
case 'leave_approved':
case 'leave_rejected': {
  const leaveId = data.leaveId ?? data.leave_id;
  if (!leaveId) return null;

  const params: Record<string, unknown> = { leaveId };
  const personId = data.personId ?? data.person_id;
  if (personId) params.personId = personId;

  return { screen: 'LeaveList', params };
}

case 'admin_leave_pending': {
  const leaveId = data.leaveId ?? data.leave_id;
  if (!leaveId) return null;

  const params: Record<string, unknown> = { leaveId };
  const personId = data.personId ?? data.person_id;
  if (personId) params.personId = personId;
  const organizationId = data.organizationId ?? data.organization_id;
  if (organizationId) params.organizationId = organizationId;

  return { screen: 'LeaveManagement', params };
}
```

### 2. Role-Aware Navigation Router (`src/navigation/navigationRef.ts`)

The `nestedRouteFor` function is extended to accept the user's role (read from `useAuthStore` at call time) and produce the correct nested route path.

**Changes:**
- `navigateToTarget` reads `useAuthStore.getState().user?.role` before calling `nestedRouteFor`
- `nestedRouteFor` signature changes from `(target) → nested | null` to `(target, role) → nested | null`
- New cases added for `LeaveList` and `LeaveManagement` with role-dependent tab routing

#### Extended `nestedRouteFor`

```typescript
import type { AppRole } from '@/types/auth';

/**
 * Maps a flat push target screen name + user role to the nested route path.
 * Returns null for unmapped screens (caller falls back to flat navigate).
 */
function nestedRouteFor(
  target: NavigationTarget,
  role: AppRole | null | undefined,
): { name: string; params: object } | null;
```

**New routing logic:**

```typescript
case 'LeaveList':
  // Stakeholder (Parent) is the only role that lands on LeaveList.
  // Null/undefined role defaults to ParentTabs (least-privileged).
  return {
    name: 'ParentTabs',
    params: {
      screen: 'Leave',
      params: {
        screen: 'LeaveList',
        params: target.params,
      },
    },
  };

case 'LeaveManagement':
  switch (role) {
    case 'Admin':
      return {
        name: 'AdminTabs',
        params: {
          screen: 'Management',
          params: {
            screen: 'LeaveManagement',
            params: target.params,
          },
        },
      };
    case 'SuperAdmin':
      return {
        name: 'SuperAdminTabs',
        params: {
          screen: 'Organizations',
          params: {
            screen: 'OrgList',
            params: target.params,
          },
        },
      };
    case 'Teacher':
      return {
        name: 'TeacherTabs',
        params: {
          screen: 'TeacherLeave',
          params: {
            screen: 'LeaveManagement',
            params: target.params,
          },
        },
      };
    default:
      // Fallback: least-privileged (ParentTabs)
      return {
        name: 'ParentTabs',
        params: {
          screen: 'Leave',
          params: {
            screen: 'LeaveList',
            params: target.params,
          },
        },
      };
  }
```

#### Updated `navigateToTarget`

```typescript
import { useAuthStore } from '@/stores/auth';

export function navigateToTarget(target: NavigationTarget): void {
  if (!navigationRef.isReady()) {
    return;
  }

  const role = useAuthStore.getState().user?.role ?? null;

  const navigate = navigationRef.navigate as unknown as (
    name: string,
    params?: object,
  ) => void;

  const nested = nestedRouteFor(target, role);
  if (nested) {
    navigate(nested.name, nested.params);
    return;
  }

  navigate(target.screen, target.params);
}
```

### 3. Backend Notification Payload (`src/services/notificationService.ts` — server-side)

The backend must include structured IDs in the notification `data` payload. No additional API calls needed on the mobile side.

#### Backend Notification Payload Interface

```typescript
/** Leave-related notification data payload sent by the backend. */
interface LeaveNotificationPayload {
  type: 'leave_approved' | 'leave_rejected' | 'admin_leave_pending';
  leave_id: string;
  person_id?: string;       // Present in leave_approved and leave_rejected
  organization_id?: string; // Present in admin_leave_pending
}
```

## Data Models

### NavigationTarget (unchanged interface, new valid values)

```typescript
export interface NavigationTarget {
  screen: string;
  params?: Record<string, unknown>;
}
```

New valid `screen` values: `'LeaveList'` | `'LeaveManagement'`

New params shapes:
```typescript
// For LeaveList
{ leaveId: string; personId?: string }

// For LeaveManagement
{ leaveId: string; personId?: string; organizationId?: string }
```

### Role-to-Tabs Mapping

| Role          | Tabs Route         | Leave Screen Path                          |
|---------------|--------------------|--------------------------------------------|
| Stakeholder   | `ParentTabs`       | `Leave > LeaveList`                        |
| Admin         | `AdminTabs`        | `Management > LeaveManagement`             |
| SuperAdmin    | `SuperAdminTabs`   | `Organizations > OrgList`                  |
| Teacher       | `TeacherTabs`      | `TeacherLeave > LeaveManagement`           |
| null/undefined| `ParentTabs`       | `Leave > LeaveList` (least-privileged)     |

## Error Handling

1. **Missing `leaveId`/`leave_id`**: `resolveNavigationTarget` returns `null` → no navigation occurs, no crash.

2. **Unknown `type` value**: The `default` case in the switch returns `null` → graceful no-op.

3. **Null/non-object payload**: The guard at the top of `resolveNavigationTarget` (`if (!data || typeof data !== 'object')`) returns `null`.

4. **Navigation container not ready**: `navigateToTarget` checks `navigationRef.isReady()` first and no-ops if false (existing behavior preserved).

5. **Unmapped screen in `nestedRouteFor`**: Returns `null`, caller falls back to flat `navigate(screen, params)` — best-effort without crash.

6. **Missing/null role at dispatch time**: The `default` case in role routing falls back to `ParentTabs` (least-privileged surface).

7. **Cold-start notification**: `coldStartHandledRef` in RootNavigator ensures at-most-once processing per app launch.

## Testing Strategy

### Unit Tests (example-based)

- **Cold-start handling**: Verify `handleNavigatorReady` calls `getLastNotificationResponseAsync` once and routes the response through `handleNotificationTapped`.
- **Idempotent cold-start**: Call `handleNavigatorReady` multiple times; verify navigation is invoked at most once.
- **Background/foreground tap**: Verify `handleNotificationTapped` resolves the target and invokes the navigation handler.
- **Navigation not ready**: Verify `navigateToTarget` is a no-op when `navigationRef.isReady()` returns false.
- **Flat fallback**: Verify that an unmapped screen name triggers `navigate(screen, params)` directly without crashing.

### Property-Based Tests

Property tests target the two pure functions (`resolveNavigationTarget` and `nestedRouteFor`) with randomized inputs to verify universal properties hold across the full input space. Minimum 100 iterations per property.

**Generator strategy:**
- Random strings for `leaveId`, `personId`, `organizationId`
- Random selection from known and unknown `type` values
- Random `AppRole` values including null/undefined
- Edge cases: empty strings, special characters, very long IDs

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Leave notification resolution produces correct screen

*For any* notification payload with `type` in `{leave_approved, leave_rejected}` and a present `leaveId` or `leave_id` field, `resolveNavigationTarget` SHALL return a NavigationTarget with `screen` equal to `'LeaveList'` and `params.leaveId` equal to the payload's leave ID value.

**Validates: Requirements 1.1, 2.1**

### Property 2: Admin leave pending resolution produces correct screen

*For any* notification payload with `type` equal to `admin_leave_pending` and a present `leaveId` or `leave_id` field, `resolveNavigationTarget` SHALL return a NavigationTarget with `screen` equal to `'LeaveManagement'` and `params.leaveId` equal to the payload's leave ID value.

**Validates: Requirements 3.1**

### Property 3: Optional person_id inclusion

*For any* leave-related notification payload (type in `{leave_approved, leave_rejected, admin_leave_pending}`) that contains a `person_id` or `personId` field with a truthy value, the resolved NavigationTarget's `params` SHALL include `personId` equal to that value.

**Validates: Requirements 1.2, 2.2, 3.2**

### Property 4: Missing leave ID returns null

*For any* notification payload with `type` in `{leave_approved, leave_rejected, admin_leave_pending}` where both `leaveId` and `leave_id` are absent, undefined, or falsy, `resolveNavigationTarget` SHALL return `null`.

**Validates: Requirements 1.3, 2.3, 3.3**

### Property 5: Role-aware routing maps leave targets to correct tab navigator

*For any* NavigationTarget with `screen` equal to `'LeaveManagement'` and any valid `AppRole`, `nestedRouteFor` SHALL return a nested route whose top-level `name` matches the role's tab navigator: `'AdminTabs'` for Admin, `'SuperAdminTabs'` for SuperAdmin, `'TeacherTabs'` for Teacher, and `'ParentTabs'` for null/undefined roles.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 6: LeaveList always routes to ParentTabs

*For any* NavigationTarget with `screen` equal to `'LeaveList'` and any role value (including null/undefined), `nestedRouteFor` SHALL return a nested route with top-level `name` equal to `'ParentTabs'` containing the path `Leave > LeaveList`.

**Validates: Requirements 4.1, 4.5**

### Property 7: Unknown notification types return null

*For any* notification payload whose `type` field is not in the set `{attendance, announcement, leave_approved, leave_rejected, admin_leave_pending}`, `resolveNavigationTarget` SHALL return `null`.

**Validates: Requirements 6.1**

### Property 8: Non-object payloads return null

*For any* input to `resolveNavigationTarget` that is `null`, `undefined`, or not a plain object, the function SHALL return `null`.

**Validates: Requirements 6.2**
