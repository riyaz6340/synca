# Design Document: Mobile Attendance Calendar

## Overview

This design describes the architecture and implementation of the Mobile Attendance Calendar feature — a read-only monthly calendar view in the Avento mobile app. Both Admin and Teacher roles can view attendance marking status across dates, with Teachers scoped to their assigned groups. The feature introduces a new screen, React Query hooks, a utility module for date-map transformations, and a minor backend authorization extension.

## Architecture

The mobile attendance calendar is a read-only monthly view added to both the Admin and Teacher attendance navigation stacks. It follows the existing app patterns: React Query for data fetching, Zustand auth store for role detection, and permission-gated navigation.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Navigation Layer                                        │
│  AdminAttendanceStack / TeacherAttendanceStack           │
│  → New "AttendanceCalendar" screen added to each stack   │
├─────────────────────────────────────────────────────────┤
│  Screen: AttendanceCalendarScreen                        │
│  ├── CalendarHeader (month title + nav arrows)           │
│  ├── Calendar (react-native-calendars)                   │
│  ├── Legend (color key)                                   │
│  └── DateDetailModal (bottom sheet / Modal)              │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  ├── useMarkedDates hook (React Query)                   │
│  ├── useTeacherGroups hook (existing, Teacher only)      │
│  └── useAllGroups hook (React Query, Admin only)         │
├─────────────────────────────────────────────────────────┤
│  API Layer                                               │
│  └── GET /api/attendance/marked-dates                    │
│      (extended to accept Teacher role on backend)        │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. AttendanceCalendarScreen

The main screen component that orchestrates data fetching and child components.

```typescript
// src/screens/attendance/AttendanceCalendarScreen.tsx

import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, type DateData, type MarkedDates } from 'react-native-calendars';

import { useAuthStore } from '@/stores/auth';
import { useMarkedDates } from '@/hooks/useMarkedDates';
import { useTeacherGroups } from '@/hooks/useTeacherGroups';
import { useAllGroups } from '@/hooks/useAllGroups';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { CalendarLegend } from '@/components/CalendarLegend';
import { DateDetailModal } from '@/components/DateDetailModal';
import { colors } from '@/components/theme';
import type { Group } from '@/types/models';

export default function AttendanceCalendarScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isTeacher = role === 'Teacher';

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group resolution based on role
  const teacherGroupsQuery = useTeacherGroups();
  const allGroupsQuery = useAllGroups({ enabled: !isTeacher });

  const groups: Group[] = isTeacher
    ? teacherGroupsQuery.data ?? []
    : allGroupsQuery.data ?? [];

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  // Fetch marked dates for all visible groups in the current month
  const markedDatesQuery = useMarkedDates({
    groupIds,
    year: currentMonth.year,
    month: currentMonth.month,
    enabled: groupIds.length > 0,
  });

  // Build react-native-calendars markedDates object
  const calendarMarkedDates: MarkedDates = useMemo(
    () => buildMarkedDatesMap(markedDatesQuery.data ?? {}),
    [markedDatesQuery.data],
  );

  const handleMonthChange = useCallback((month: DateData) => {
    setCurrentMonth({ year: month.year, month: month.month });
  }, []);

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  // Loading state
  const isInitialLoading =
    (isTeacher ? teacherGroupsQuery.isLoading : allGroupsQuery.isLoading) ||
    (groupIds.length > 0 && markedDatesQuery.isLoading);

  // Error state
  const hasError = markedDatesQuery.isError;

  if (isInitialLoading) {
    return <SkeletonLoader count={6} testID="calendar-skeleton" />;
  }

  if (hasError) {
    return (
      <ErrorState
        message="Failed to load attendance data"
        onRetry={() => markedDatesQuery.refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={`${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`}
        onMonthChange={handleMonthChange}
        onDayPress={handleDayPress}
        markedDates={calendarMarkedDates}
        markingType="dot"
        theme={calendarTheme}
        testID="attendance-calendar"
      />
      <CalendarLegend />
      <DateDetailModal
        visible={selectedDate !== null}
        date={selectedDate}
        groups={groups}
        markedDatesByGroup={markedDatesQuery.data ?? {}}
        onDismiss={() => setSelectedDate(null)}
      />
    </View>
  );
}
```

### 2. useMarkedDates Hook

A React Query hook that fetches marked dates for multiple groups in parallel and aggregates results.

```typescript
// src/hooks/useMarkedDates.ts

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface MarkedDatesParams {
  groupIds: string[];
  year: number;
  month: number;
  enabled?: boolean;
}

/** Map of groupId → array of date strings ('YYYY-MM-DD') marked for that group. */
export type MarkedDatesByGroup = Record<string, string[]>;

export const MARKED_DATES_QUERY_KEY = ['attendance', 'marked-dates'] as const;

/**
 * Fetch marked dates for each group in the given month, returning a map of
 * groupId → marked date strings.
 */
export function useMarkedDates({
  groupIds,
  year,
  month,
  enabled = true,
}: MarkedDatesParams): UseQueryResult<MarkedDatesByGroup, Error> {
  return useQuery({
    queryKey: [...MARKED_DATES_QUERY_KEY, { groupIds, year, month }],
    queryFn: async (): Promise<MarkedDatesByGroup> => {
      const results = await Promise.all(
        groupIds.map(async (groupId) => {
          const res = await apiClient.get<{ marked_dates: string[] }>(
            '/api/attendance/marked-dates',
            { params: { group_id: groupId, year, month } },
          );
          return { groupId, dates: res.data.marked_dates };
        }),
      );

      const map: MarkedDatesByGroup = {};
      for (const { groupId, dates } of results) {
        map[groupId] = dates;
      }
      return map;
    },
    enabled: enabled && groupIds.length > 0,
  });
}
```

### 3. useAllGroups Hook

A React Query hook for Admin users to fetch all organization groups.

```typescript
// src/hooks/useAllGroups.ts

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import type { Group } from '@/types/models';

export const ALL_GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

export function useAllGroups(options?: {
  enabled?: boolean;
}): UseQueryResult<Group[], Error> {
  return useQuery({
    queryKey: ALL_GROUPS_QUERY_KEY,
    queryFn: () => adminApi.getGroups(),
    enabled: options?.enabled ?? true,
  });
}
```

### 4. CalendarLegend Component

A simple presentational component displaying the color key.

```typescript
// src/components/CalendarLegend.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from './theme';

export function CalendarLegend(): React.ReactElement {
  return (
    <View style={styles.container} testID="calendar-legend">
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: colors.present }]} />
        <Text style={styles.label}>Marked</Text>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: colors.border }]} />
        <Text style={styles.label}>Unmarked</Text>
      </View>
    </View>
  );
}
```

### 5. DateDetailModal Component

A modal (or bottom sheet if `@gorhom/bottom-sheet` is available) that shows which groups have attendance marked for a selected date.

```typescript
// src/components/DateDetailModal.tsx

import React, { useMemo } from 'react';
import { Modal, View, Text, FlatList, Pressable, StyleSheet } from 'react-native';

import { colors, spacing, radius } from './theme';
import type { Group } from '@/types/models';
import type { MarkedDatesByGroup } from '@/hooks/useMarkedDates';

interface Props {
  visible: boolean;
  date: string | null;
  groups: Group[];
  markedDatesByGroup: MarkedDatesByGroup;
  onDismiss: () => void;
}

export interface GroupDateStatus {
  groupId: string;
  groupName: string;
  isMarked: boolean;
}

/**
 * Pure function to compute group statuses for a given date.
 * For any date and set of groups, returns each group with its marking status.
 */
export function computeGroupDateStatuses(
  date: string,
  groups: Group[],
  markedDatesByGroup: MarkedDatesByGroup,
): GroupDateStatus[] {
  return groups.map((group) => ({
    groupId: group.id,
    groupName: group.name,
    isMarked: (markedDatesByGroup[group.id] ?? []).includes(date),
  }));
}

export function DateDetailModal({
  visible,
  date,
  groups,
  markedDatesByGroup,
  onDismiss,
}: Props): React.ReactElement | null {
  const statuses = useMemo(() => {
    if (!date) return [];
    return computeGroupDateStatuses(date, groups, markedDatesByGroup);
  }, [date, groups, markedDatesByGroup]);

  const hasMarked = statuses.some((s) => s.isMarked);

  if (!visible || !date) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID="date-detail-modal"
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>

          {!hasMarked ? (
            <Text style={styles.emptyText}>
              No attendance was recorded for this date.
            </Text>
          ) : (
            <FlatList
              data={statuses}
              keyExtractor={(item) => item.groupId}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: item.isMarked
                          ? colors.present
                          : colors.notMarked,
                      },
                    ]}
                  />
                  <Text style={styles.groupName}>{item.groupName}</Text>
                  <Text style={styles.statusLabel}>
                    {item.isMarked ? 'Marked' : 'Not Marked'}
                  </Text>
                </View>
              )}
            />
          )}

          <Pressable style={styles.closeButton} onPress={onDismiss}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
```

### 6. buildMarkedDatesMap Utility

A pure function that transforms the `MarkedDatesByGroup` data into the format expected by `react-native-calendars`.

```typescript
// src/utils/calendarUtils.ts

import type { MarkedDates } from 'react-native-calendars';
import type { MarkedDatesByGroup } from '@/hooks/useMarkedDates';

/**
 * Transform a MarkedDatesByGroup map into the react-native-calendars
 * MarkedDates format. Any date that appears in at least one group's
 * marked list receives a green dot.
 *
 * Pure function — deterministic output for a given input.
 */
export function buildMarkedDatesMap(
  markedDatesByGroup: MarkedDatesByGroup,
): MarkedDates {
  const allDates = new Set<string>();

  for (const dates of Object.values(markedDatesByGroup)) {
    for (const d of dates) {
      allDates.add(d);
    }
  }

  const result: MarkedDates = {};
  for (const date of allDates) {
    result[date] = {
      marked: true,
      dotColor: '#16a34a', // colors.present (green)
    };
  }
  return result;
}

/**
 * Determine whether a date has a marking indicator.
 * Returns true iff the date appears in at least one group's marked dates.
 */
export function isDateMarked(
  date: string,
  markedDatesByGroup: MarkedDatesByGroup,
): boolean {
  for (const dates of Object.values(markedDatesByGroup)) {
    if (dates.includes(date)) return true;
  }
  return false;
}

/**
 * Get all unique marked dates from all groups combined.
 */
export function getAllMarkedDates(
  markedDatesByGroup: MarkedDatesByGroup,
): string[] {
  const allDates = new Set<string>();
  for (const dates of Object.values(markedDatesByGroup)) {
    for (const d of dates) {
      allDates.add(d);
    }
  }
  return [...allDates];
}

/**
 * Filter groups to only those assigned to a specific set of group IDs.
 * Used to enforce teacher-scoped filtering.
 */
export function filterGroupsByIds<T extends { id: string }>(
  groups: T[],
  allowedIds: string[],
): T[] {
  const idSet = new Set(allowedIds);
  return groups.filter((g) => idSet.has(g.id));
}
```

## Data Models

### API Response Types

```typescript
// Extension to existing types

/** Response from GET /api/attendance/marked-dates */
export interface MarkedDatesResponse {
  marked_dates: string[]; // Array of 'YYYY-MM-DD' strings
}

/** Request params for GET /api/attendance/marked-dates */
export interface MarkedDatesParams {
  group_id: string;
  year: number;
  month: number;
}
```

### Navigation Types Extension

```typescript
// Add to existing AdminAttendanceStackParamList
export type AdminAttendanceStackParamList = {
  GroupList: undefined;
  AttendanceCalendar: undefined; // NEW
  AttendanceMode: { groupId: string; groupName: string };
  BulkMarking: { groupId: string; groupName: string };
  SequentialAttendance: { groupId: string; groupName: string };
  AttendanceSummary: { groupId: string; groupName: string; marks: string };
};

// Add to existing TeacherAttendanceStackParamList
export type TeacherAttendanceStackParamList = {
  GroupList: undefined;
  AttendanceCalendar: undefined; // NEW
  AttendanceMode: { groupId: string; groupName: string };
  BulkMarking: { groupId: string; groupName: string };
  SequentialAttendance: { groupId: string; groupName: string };
  AttendanceSummary: { groupId: string; groupName: string; marks: string };
};
```

### Internal State

```typescript
/** The current month being viewed in the calendar. */
interface CalendarMonth {
  year: number;  // e.g., 2024
  month: number; // 1-12
}
```

## Interfaces

### Backend API Extension

The existing `GET /api/attendance/marked-dates` endpoint is extended to allow `Teacher` role:

```typescript
// src/routes/attendance.ts — change authorize('Admin') → authorize('Admin', 'Teacher')

router.get(
  '/marked-dates',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Teacher'), // CHANGED: was authorize('Admin')
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, year, month } = req.query;
    if (!group_id || !year || !month) {
      res.status(400).json({ error: 'group_id, year, and month are required' });
      return;
    }

    // NEW: For Teacher role, validate they have access to the requested group
    if (req.user.role === 'Teacher') {
      const hasAccess = await db('teacher_group_assignments')
        .where({ teacher_id: req.user.id, group_id: group_id as string })
        .first();
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to this group' });
        return;
      }
    }

    const startDate = `${year}-${String(Number(month)).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${String(Number(month)).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const dates = await db('attendance_records')
      .join('person_groups', 'attendance_records.person_id', 'person_groups.person_id')
      .where('person_groups.group_id', group_id as string)
      .where('attendance_records.organization_id', req.organizationId)
      .whereBetween('attendance_records.date', [startDate, endDate])
      .select('attendance_records.date')
      .distinct();

    res.json({ marked_dates: dates.map((d) => d.date) });
  },
);
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Groups API fails (initial load) | Show `ErrorState` with retry button |
| Marked dates API fails | Show `ErrorState` with retry button |
| Individual group fetch fails (in parallel) | Return empty array for that group; calendar shows partial data |
| Network offline | React Query will not retry; show cached data if available |
| User taps retry | Re-invoke `refetch()` on the failed query |
| Teacher has no assigned groups | Show `EmptyState` with informational message |
| Invalid API response (missing `marked_dates` field) | Default to empty array `[]` |

## Testing Strategy

- **Property-based tests** (fast-check): Validate pure utility functions (`buildMarkedDatesMap`, `computeGroupDateStatuses`, `filterGroupsByIds`, `isDateMarked`) with generated inputs covering varied group/date combinations.
- **Example-based unit tests**: Verify React component rendering (skeleton loader, error state, legend presence, modal open/close), navigation entry points, and read-only constraint (no mutation controls).
- **Integration tests** (MSW): Verify the `useMarkedDates` hook correctly fetches and aggregates data from the API, handles errors, and passes correct parameters for each role.
- **Backend unit tests**: Verify the authorization extension allows Teacher role and filters by assigned groups.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Date marking indicator correctness

*For any* month and set of marked dates returned by the API, a date in the calendar receives a green dot indicator if and only if that date appears in at least one group's marked dates list.

**Validates: Requirements 2.2, 2.3**

### Property 2: Date detail view shows correct group statuses

*For any* selected date, set of visible groups, and marked-dates-by-group map, the Date Detail View SHALL display each group with `isMarked = true` if and only if that date appears in the group's marked dates array.

**Validates: Requirements 4.1, 4.2**

### Property 3: Teacher group filtering completeness

*For any* Teacher user with a set of assigned groups, all data displayed in the calendar (marked date dots and detail view groups) SHALL reference only groups whose IDs are in the teacher's assigned groups set — no other groups appear.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 4: Admin group completeness

*For any* Admin user and organization with N groups, the Date Detail View SHALL display exactly N groups (the full set of organization groups) regardless of which date is selected.

**Validates: Requirements 6.1, 6.2**

### Property 5: Backend teacher authorization filtering

*For any* Teacher user requesting marked dates via the API, the response SHALL contain only dates from groups assigned to that teacher — dates from unassigned groups are never included in the response.

**Validates: Requirements 8.1, 8.2**
