/**
 * DateDetailModal — A modal showing per-group attendance status for a selected date.
 *
 * Displays the date formatted in en-IN locale, a list of groups with
 * colored dot indicators (green = marked, gray = not marked), and an
 * empty message when no attendance was recorded.
 *
 * Read-only: no mutation controls are rendered.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 7.2
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';

import { colors, spacing, radius } from './theme';
import type { Group } from '@/types/models';
import type { MarkedDatesByGroup } from '@/utils/calendarUtils';
import { computeGroupDateStatuses } from '@/utils/calendarUtils';

// Re-export for convenience and testing
export { computeGroupDateStatuses } from '@/utils/calendarUtils';
export type { GroupDateStatus } from '@/utils/calendarUtils';

interface Props {
  visible: boolean;
  date: string | null;
  groups: Group[];
  markedDatesByGroup: MarkedDatesByGroup;
  onDismiss: () => void;
}

/**
 * Format a YYYY-MM-DD date string into a human-readable en-IN locale string.
 * Example: "Monday, 15 January 2024"
 */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
      <Pressable
        style={styles.overlay}
        onPress={onDismiss}
        testID="date-detail-overlay"
      >
        <View
          style={styles.sheet}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title} testID="date-detail-title">
            {formatDateLabel(date)}
          </Text>

          {!hasMarked ? (
            <Text style={styles.emptyText} testID="date-detail-empty">
              No attendance was recorded for this date.
            </Text>
          ) : (
            <FlatList
              data={statuses}
              keyExtractor={(item) => item.groupId}
              testID="date-detail-group-list"
              renderItem={({ item }) => (
                <View style={styles.row} testID={`group-row-${item.groupId}`}>
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
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: item.isMarked ? colors.present : colors.notMarked },
                    ]}
                  >
                    {item.isMarked ? 'Marked' : 'Not Marked'}
                  </Text>
                </View>
              )}
            />
          )}

          <Pressable
            style={styles.closeButton}
            onPress={onDismiss}
            testID="date-detail-close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default DateDetailModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  groupName: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
});
