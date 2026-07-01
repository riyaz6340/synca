/**
 * Shared visual constants for the reusable UI component library.
 *
 * Keeping a single small palette here means presentational components
 * (StatusBadge, OfflineBanner, EmptyState, etc.) stay visually consistent
 * without each one re-declaring colors and spacing.
 */
import type { DisplayPresenceStatus, PresenceStatus } from '../types/models';

export const colors = {
  primary: '#2563eb',
  primaryText: '#ffffff',

  background: '#ffffff',
  surface: '#f3f4f6',
  border: '#e5e7eb',

  text: '#111827',
  textMuted: '#6b7280',

  // Status palette (presence)
  present: '#16a34a', // green
  absent: '#dc2626', // red
  late: '#d97706', // yellow / amber
  onLeave: '#2563eb', // blue
  notMarked: '#9ca3af', // gray

  // Feedback
  danger: '#dc2626',
  warning: '#f59e0b',
  warningSurface: '#fef3c7',
  warningText: '#92400e',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  pill: 999,
} as const;

const DEFAULT_PRIMARY = '#2563eb';

/**
 * Returns a themed colors object with `primary` replaced by the override
 * when provided, or the default `#2563eb` otherwise.
 */
export function getThemedColors(primaryOverride?: string | null) {
  const primary = primaryOverride ?? DEFAULT_PRIMARY;
  return {
    ...colors,
    primary,
  };
}

/** Visual descriptor (background color + human label) for a presence status. */
export interface StatusVisual {
  color: string;
  label: string;
}

/**
 * Map a presence status (including the UI-only "Not yet marked" and the
 * common "Not Marked" variant) to its badge color and display label.
 */
export function getStatusVisual(
  status: PresenceStatus | DisplayPresenceStatus | 'Not Marked' | null | undefined
): StatusVisual {
  switch (status) {
    case 'Present':
      return { color: colors.present, label: 'Present' };
    case 'Absent':
      return { color: colors.absent, label: 'Absent' };
    case 'Late':
      return { color: colors.late, label: 'Late' };
    case 'On_Leave':
      return { color: colors.onLeave, label: 'On Leave' };
    case 'Not yet marked':
    case 'Not Marked':
    case null:
    case undefined:
    default:
      return { color: colors.notMarked, label: 'Not Marked' };
  }
}
