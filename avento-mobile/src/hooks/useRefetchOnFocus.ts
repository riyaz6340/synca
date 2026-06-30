/**
 * `useRefetchOnFocus` — opt-in hook that triggers a background refresh of one
 * or more React Query keys whenever the screen regains focus, but only if the
 * cached data is stale (per the client's `staleTime`).
 *
 * This gives the "show cached data immediately, then background-refresh"
 * behavior (Requirements 21.5, 23.1) without rewriting every screen: a screen
 * simply calls `useRefetchOnFocus(queryKey)`. The refresh is scoped to stale,
 * active queries (`stale: true`, `type: 'active'`), so a freshly-fetched
 * screen revisited within the client's `staleTime` (30s) won't refetch
 * needlessly while genuinely stale data refreshes in the background.
 *
 * Screens that don't import this hook are unaffected; `refetchOnReconnect` is
 * still enabled globally on the shared client.
 *
 * Validates: Requirements 21.5, 23.1
 */
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Refetch the given query key(s) on screen focus when stale.
 *
 * @param queryKey A single query key to refresh on focus.
 * @param options.enabled Set to false to disable the focus refresh (e.g. while
 *   a screen is in an error/empty state). Defaults to true.
 */
export function useRefetchOnFocus(
  queryKey: QueryKey,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }
      // Refetch only stale, currently-active (mounted) queries in the
      // background. React Query's `stale: true` filter honors the client's
      // staleTime, so this is a no-op for data fetched within the last 30s.
      void queryClient.refetchQueries({ queryKey, type: 'active', stale: true });
      // No cleanup needed; the refetch is fire-and-forget.
    }, [enabled, queryClient, queryKey]),
  );
}

export default useRefetchOnFocus;
