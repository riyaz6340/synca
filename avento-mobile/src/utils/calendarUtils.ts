/**
 * Pure utility functions for the Mobile Attendance Calendar feature.
 *
 * All functions are side-effect-free: no hooks, no API calls, no external state.
 * They transform attendance data between internal and react-native-calendars formats.
 *
 * Validates: Requirements 2.2, 2.3, 5.1
 */

import type { Group } from '@/types/models';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Maps groupId → array of date strings ('YYYY-MM-DD') marked for that group.
 */
export type MarkedDatesByGroup = Record<string, string[]>;

/**
 * A single date's marking props, compatible with react-native-calendars.
 */
export interface DateMarkingProps {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
}

/**
 * The MarkedDates object expected by react-native-calendars Calendar component.
 * Maps date strings ('YYYY-MM-DD') to their marking props.
 */
export type MarkedDatesMap = Record<string, DateMarkingProps>;

/**
 * Status of a single group for a given date.
 */
export interface GroupDateStatus {
  groupId: string;
  groupName: string;
  isMarked: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Green dot color for marked dates. */
const MARKED_DOT_COLOR = '#16a34a';

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Transform a MarkedDatesByGroup map into the react-native-calendars
 * MarkedDates format. Any date that appears in at least one group's
 * marked list receives a green dot.
 *
 * Pure function — deterministic output for a given input.
 */
export function buildMarkedDatesMap(
  markedDatesByGroup: MarkedDatesByGroup,
): MarkedDatesMap {
  const allDates = new Set<string>();

  for (const dates of Object.values(markedDatesByGroup)) {
    for (const d of dates) {
      allDates.add(d);
    }
  }

  const result: MarkedDatesMap = {};
  for (const date of allDates) {
    result[date] = {
      marked: true,
      dotColor: MARKED_DOT_COLOR,
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
 * Returns a deduplicated array of 'YYYY-MM-DD' strings.
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
 * Filter groups to only those whose IDs are in the allowed set.
 * Used to enforce teacher-scoped filtering.
 */
export function filterGroupsByIds<T extends { id: string }>(
  groups: T[],
  allowedIds: string[],
): T[] {
  const idSet = new Set(allowedIds);
  return groups.filter((g) => idSet.has(g.id));
}

/**
 * Compute group-level marking statuses for a given date.
 * For each group, determines whether the date appears in that group's
 * marked dates array.
 *
 * Used by the DateDetailModal to display per-group status indicators.
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
