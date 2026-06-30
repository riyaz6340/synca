/**
 * SearchableDropdown — a generic, searchable single-select control used for
 * organization selection at login and group selection in admin flows.
 *
 * Generic over the item type with a `getLabel` accessor. Filtering uses
 * case-insensitive substring matching via the shared `filterByName` helper
 * (also reused by the login screen and the Property 11 property test).
 *
 * Validates: Requirement 24.2
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { filterByName } from '../utils/filterByName';
import { colors, radius, spacing } from './theme';

export { filterByName };

export interface SearchableDropdownProps<T> {
  items: readonly T[];
  /** Returns the display label used for both rendering and filtering. */
  getLabel: (item: T) => string;
  /** Returns a stable key for an item. Defaults to the label. */
  getKey?: (item: T) => string;
  selected?: T | null;
  onSelect: (item: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  testID?: string;
}

export function SearchableDropdown<T>({
  items,
  getLabel,
  getKey,
  selected,
  onSelect,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches found',
  testID = 'searchable-dropdown',
}: SearchableDropdownProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const keyFor = (item: T, index: number): string =>
    getKey ? getKey(item) : `${getLabel(item)}-${index}`;

  const filtered = useMemo(
    () => filterByName(items, search, getLabel),
    [items, search, getLabel]
  );

  const handleSelect = (item: T): void => {
    onSelect(item);
    setOpen(false);
    setSearch('');
  };

  return (
    <View testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        style={styles.trigger}
        onPress={() => setOpen(true)}
        testID={`${testID}-trigger`}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? getLabel(selected) : placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <TextInput
              style={styles.search}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              testID={`${testID}-search`}
            />
            <FlatList
              data={filtered}
              keyExtractor={keyFor}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={styles.option}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.optionText}>{getLabel(item)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>{emptyText}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  triggerText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.textMuted,
  },
  caret: {
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.xl,
  },
});

export default SearchableDropdown;
