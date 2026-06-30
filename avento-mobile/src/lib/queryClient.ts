/**
 * Shared application React Query client + connectivity wiring.
 *
 * This is the single {@link QueryClient} instance the running app uses (wired
 * into the tree by {@link ../../App}). Screens/hooks read and write the server
 * cache through it via `useQuery`/`useMutation`.
 *
 * Defaults (task 15.2 — caching & offline support, Requirements 21.1/21.5/23.1):
 *   - retry: 2                — retry transient failures a couple of times.
 *   - staleTime: 30s          — treat data as fresh for 30s so navigating back
 *                               to a screen shows cached data without an
 *                               immediate refetch; stale data triggers a
 *                               background refresh (see {@link useRefetchOnFocus}).
 *   - gcTime: 24h             — keep cached data in memory long enough that it
 *                               survives for offline reads within a session.
 *                               Combined with AsyncStorage persistence (see
 *                               {@link ./queryPersistence}) cached data also
 *                               survives an app restart.
 *   - refetchOnReconnect: true — when connectivity is restored, active queries
 *                               refetch automatically.
 *   - refetchOnWindowFocus: false — not meaningful on native; focus-based
 *                               refresh is handled explicitly per-screen.
 *
 * Persistence choice: the optional `@tanstack/react-query-persist-client` /
 * `@tanstack/query-async-storage-persister` packages are NOT installed, so we
 * implement a small, dependency-free AsyncStorage persistence layer using the
 * built-in `dehydrate`/`hydrate` utilities (see {@link ./queryPersistence}).
 *
 * Tests do NOT use this client: `renderWithProviders` creates its own
 * test-tuned client so assertions stay deterministic.
 */
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';

/** How long fetched data is considered fresh before a background refresh. */
export const QUERY_STALE_TIME_MS = 30_000;

/**
 * How long unused/inactive cached data is retained in memory (garbage-collect
 * time). 24h keeps data available for offline reads across a session.
 */
export const QUERY_GC_TIME_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: QUERY_STALE_TIME_MS,
      gcTime: QUERY_GC_TIME_MS,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Bridge NetInfo connectivity into React Query's {@link onlineManager} so that
 * `refetchOnReconnect` and paused mutations behave correctly on React Native
 * (React Query has no built-in online detection outside the browser).
 *
 * The device is considered online when connected and internet reachability is
 * not explicitly `false` (it may be `null` while being determined — we treat
 * unknown-but-connected as online to avoid stalling refetches).
 *
 * Call once during app bootstrap. Returns a disposer that detaches the
 * NetInfo listener.
 */
export function initOnlineManager(): () => void {
  let netInfoUnsubscribe: (() => void) | undefined;

  onlineManager.setEventListener((setOnline) => {
    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return netInfoUnsubscribe;
  });

  return () => {
    netInfoUnsubscribe?.();
    netInfoUnsubscribe = undefined;
  };
}
