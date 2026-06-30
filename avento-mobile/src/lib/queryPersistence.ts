/**
 * Lightweight AsyncStorage-backed persistence for the React Query cache.
 *
 * Why hand-rolled: the official `@tanstack/react-query-persist-client` +
 * `@tanstack/query-async-storage-persister` packages are not installed in this
 * project. Rather than add two dependencies for a small need, this module uses
 * React Query's built-in {@link dehydrate}/{@link hydrate} utilities to
 * snapshot successful query results to AsyncStorage and restore them on the
 * next launch. The result: every screen shows its last-fetched data
 * immediately on app start (Requirement 21.1/21.5/23.1), then background-
 * refreshes per the client's `staleTime`.
 *
 * Storage shape (under a versioned key so format changes invalidate cleanly):
 *   { timestamp: number; state: DehydratedState }
 *
 * Only `success` queries are persisted (the React Query default for
 * `dehydrate`), so we never restore loading/error placeholders. A persisted
 * snapshot older than {@link MAX_PERSISTED_AGE_MS} is discarded on hydrate so
 * we never show data that is too stale to be useful offline.
 *
 * Writes are debounced so a burst of cache updates results in a single
 * AsyncStorage write.
 *
 * Validates: Requirements 21.1, 21.5, 23.1
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';

/** Versioned AsyncStorage key for the persisted query cache snapshot. */
export const QUERY_CACHE_STORAGE_KEY = 'avento.query.cache.v1';

/** Debounce window (ms) for coalescing cache updates into one write. */
export const PERSIST_DEBOUNCE_MS = 1_000;

/**
 * Maximum age of a persisted snapshot that we will restore. Matches the
 * client's 24h gcTime so offline reads use data no older than a day.
 */
export const MAX_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

/** JSON payload persisted to AsyncStorage. */
export interface PersistedQueryCache {
  /** Epoch millis when the snapshot was written. */
  timestamp: number;
  /** React Query's dehydrated (serializable) cache state. */
  state: DehydratedState;
}

/**
 * Restore a previously persisted cache snapshot into `client`.
 *
 * No-ops when nothing is stored, when the payload is malformed/corrupt, or when
 * the snapshot is older than {@link MAX_PERSISTED_AGE_MS} (in which case the
 * stale entry is removed). Never throws — a failed hydrate must not block app
 * startup.
 *
 * @param now Injectable clock for deterministic tests.
 */
export async function hydrateQueryClient(
  client: QueryClient,
  now: number = Date.now(),
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedQueryCache> | null;
    if (!parsed || typeof parsed.timestamp !== 'number' || parsed.state == null) {
      // Malformed payload — drop it so we start clean next time.
      await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
      return;
    }

    if (now - parsed.timestamp > MAX_PERSISTED_AGE_MS) {
      // Too old to be useful — discard rather than restore stale data.
      await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
      return;
    }

    hydrate(client, parsed.state);
  } catch {
    // Corrupt JSON / storage error: ignore and continue with an empty cache.
  }
}

/**
 * Write a snapshot of `client`'s current cache to AsyncStorage.
 *
 * Uses `dehydrate`, which by default only includes successful queries, so we
 * never persist loading or error states. Best-effort — never throws.
 *
 * @param now Injectable clock for deterministic tests.
 */
export async function persistQueryClient(
  client: QueryClient,
  now: number = Date.now(),
): Promise<void> {
  try {
    const payload: PersistedQueryCache = {
      timestamp: now,
      state: dehydrate(client),
    };
    await AsyncStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort persistence: a failed write just means a missed snapshot.
  }
}

/** Remove the persisted cache snapshot (e.g. on logout). Never throws. */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Ignore — there is nothing more we can do if removal fails.
  }
}

/**
 * Hydrate the cache from storage, then subscribe to the query cache and
 * debounce-persist successful results.
 *
 * Call once during app bootstrap. Returns a disposer that stops the
 * subscription and cancels any pending write.
 */
export async function initQueryPersistence(
  client: QueryClient,
): Promise<() => void> {
  await hydrateQueryClient(client);

  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedulePersist = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void persistQueryClient(client);
    }, PERSIST_DEBOUNCE_MS);
  };

  const unsubscribe = client.getQueryCache().subscribe(schedulePersist);

  return () => {
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
