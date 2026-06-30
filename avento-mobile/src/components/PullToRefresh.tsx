/**
 * PullToRefresh — a thin wrapper around a scrollable container that wires up a
 * RefreshControl so any list/dashboard screen gets pull-to-refresh for free.
 *
 * By default it wraps a ScrollView (good for dashboards / short content). For
 * long lists, pass the same `refreshing`/`onRefresh` props to a FlatList via
 * the exported `useRefreshControl` helper instead.
 *
 * Validates: Requirement 23.4
 */
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from './theme';

export interface PullToRefreshProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PullToRefresh({
  refreshing,
  onRefresh,
  children,
  contentContainerStyle,
  testID = 'pull-to-refresh',
  ...scrollViewProps
}: PullToRefreshProps): React.ReactElement {
  return (
    <ScrollView
      testID={testID}
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Build a RefreshControl for use with a FlatList/SectionList. Keeps the same
 * styling as the ScrollView-based PullToRefresh.
 */
export function useRefreshControl(
  refreshing: boolean,
  onRefresh: () => void
): React.ReactElement {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.primary]}
      tintColor={colors.primary}
    />
  );
}

export default PullToRefresh;
