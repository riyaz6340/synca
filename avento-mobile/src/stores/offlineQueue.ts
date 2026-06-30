/**
 * Offline write-operation queue (Zustand store).
 *
 * Write operations (POST/PUT/PATCH/DELETE) that cannot reach the server while
 * the device is offline are enqueued here and replayed automatically once
 * connectivity is restored. The queue is persisted to AsyncStorage so pending
 * work survives an app restart.
 *
 * Design guarantees (see design.md "Correctness Properties"):
 *  - **Property 2 — ordering preservation**: queued operations are processed
 *    strictly in chronological order (by `timestamp`, ties broken by insertion
 *    order via a stable sort). Operations are awaited sequentially so the
 *    server observes them in the same order the user performed them.
 *  - **Property 3 — idempotent processing**: every successfully replayed
 *    operation id is recorded in `completedIds`. Re-processing the queue (e.g.
 *    a second connectivity event firing) never re-submits an operation that has
 *    already succeeded.
 *
 * Retry policy (see design.md "Retry Strategy"):
 *  - Up to 3 automatic retries with exponential backoff (1s, 2s, 4s).
 *  - After retries are exhausted the item is marked `failed` and retained in
 *    the queue for manual {@link retryItem} / {@link discardItem} by the user.
 *
 * Testability: the operation executor, the backoff delay function, and the
 * persistence layer are injectable via {@link configureOfflineQueue} so the
 * property tests in task 3.4 can drive `processQueue` deterministically without
 * a real network, real timers, or real AsyncStorage.
 *
 * Validates: Requirements 21.2, 21.3, 21.4
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

import { apiClient } from '@/api/client';
import type { OfflineQueueStore, QueuedOperation } from '@/types/api';
import { uuidv4 } from '@/utils/uuid';

/** AsyncStorage key under which the queue + completed-id ledger is persisted. */
export const OFFLINE_QUEUE_STORAGE_KEY = 'avento.offline.queue';

/** Default maximum number of automatic retries before an item is left failed. */
export const DEFAULT_MAX_RETRIES = 3;

/** Shape of the JSON payload persisted to AsyncStorage. */
interface PersistedQueue {
  queue: QueuedOperation[];
  completedIds: string[];
}

// ---------------------------------------------------------------------------
// Injectable dependencies (overridable in tests via configureOfflineQueue).
// ---------------------------------------------------------------------------

/** Replays a single queued operation against the backend. */
export type OperationExecutor = (op: QueuedOperation) => Promise<void>;

/** Returns the backoff delay (ms) to wait before retry attempt `attempt`. */
export type BackoffDelay = (attempt: number) => number;

/** Persists the queue + completed-id ledger. */
export type QueuePersister = (data: PersistedQueue) => Promise<void>;

/** Default executor: replay the operation through the shared API client. */
const defaultExecutor: OperationExecutor = async (op) => {
  await apiClient.request({
    method: op.method,
    url: op.url,
    data: op.body,
  });
};

/**
 * Default exponential backoff. `attempt` is 1-based, so the produced delays are
 * 1000ms, 2000ms, 4000ms for the first, second and third retry respectively.
 */
const defaultBackoff: BackoffDelay = (attempt) => 1000 * 2 ** (attempt - 1);

/** Default persister: write the queue to AsyncStorage as JSON. */
const defaultPersister: QueuePersister = async (data) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(data));
};

const runtime: {
  executor: OperationExecutor;
  backoff: BackoffDelay;
  persister: QueuePersister;
  sleep: (ms: number) => Promise<void>;
} = {
  executor: defaultExecutor,
  backoff: defaultBackoff,
  persister: defaultPersister,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Override the offline-queue dependencies. Intended for app bootstrap (rarely)
 * and for tests (to inject a mock executor, zero-delay backoff, and an
 * in-memory persister so processing is fast and deterministic).
 */
export function configureOfflineQueue(config: {
  executor?: OperationExecutor;
  backoff?: BackoffDelay;
  persister?: QueuePersister;
  sleep?: (ms: number) => Promise<void>;
}): void {
  if (config.executor) runtime.executor = config.executor;
  if (config.backoff) runtime.backoff = config.backoff;
  if (config.persister) runtime.persister = config.persister;
  if (config.sleep) runtime.sleep = config.sleep;
}

/** Restore the injectable dependencies to their production defaults. */
export function resetOfflineQueueConfig(): void {
  runtime.executor = defaultExecutor;
  runtime.backoff = defaultBackoff;
  runtime.persister = defaultPersister;
  runtime.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit/property testing).
// ---------------------------------------------------------------------------

/**
 * Return a new array of operations ordered chronologically by `timestamp`.
 *
 * Ties are broken by insertion order: the sort is stable (Array.prototype.sort
 * is guaranteed stable under V8/Hermes), so two operations sharing a timestamp
 * retain their relative order in the input array.
 */
export function orderQueue(queue: readonly QueuedOperation[]): QueuedOperation[] {
  return [...queue].sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Store definition.
// ---------------------------------------------------------------------------

/** Internal store state: the public interface plus the idempotency ledger. */
interface OfflineQueueState extends OfflineQueueStore {
  /** Ids of operations that have already been successfully replayed. */
  completedIds: string[];
  /** Load the persisted queue from AsyncStorage (call once on app start). */
  hydrate: () => Promise<void>;
}

/** Persist the current state via the configured persister (fire-and-forget safe). */
async function persistState(state: OfflineQueueState): Promise<void> {
  await runtime.persister({ queue: state.queue, completedIds: state.completedIds });
}

export const useOfflineQueue = create<OfflineQueueState>((set, get) => ({
  queue: [],
  isProcessing: false,
  completedIds: [],

  enqueue: (op) => {
    const operation: QueuedOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      maxRetries: op.maxRetries ?? DEFAULT_MAX_RETRIES,
      method: op.method,
      url: op.url,
      body: op.body,
    };
    set((state) => ({ queue: [...state.queue, operation] }));
    void persistState(get());
  },

  processQueue: async () => {
    // Guard against concurrent runs so an operation is never executed twice in
    // overlapping passes (supports the idempotency property).
    if (get().isProcessing) {
      return;
    }
    set({ isProcessing: true });

    try {
      // Snapshot + order at the start; new enqueues during this pass will be
      // picked up by the next processQueue call.
      const ordered = orderQueue(get().queue);

      for (const op of ordered) {
        // Idempotency: never re-submit an operation that already succeeded.
        if (get().completedIds.includes(op.id)) {
          set((state) => ({ queue: state.queue.filter((q) => q.id !== op.id) }));
          continue;
        }

        // Skip if the item was removed (discarded) while we were processing.
        if (!get().queue.some((q) => q.id === op.id)) {
          continue;
        }

        const succeeded = await replayWithRetries(op, set, get);

        if (succeeded) {
          set((state) => ({
            queue: state.queue.filter((q) => q.id !== op.id),
            completedIds: state.completedIds.includes(op.id)
              ? state.completedIds
              : [...state.completedIds, op.id],
          }));
        } else {
          // Mark as failed and leave in the queue for manual user action.
          set((state) => ({
            queue: state.queue.map((q) =>
              q.id === op.id ? { ...q, status: 'failed' as const } : q,
            ),
          }));
        }

        await persistState(get());
      }
    } finally {
      set({ isProcessing: false });
      await persistState(get());
    }
  },

  retryItem: async (id) => {
    const item = get().queue.find((q) => q.id === id);
    if (!item) {
      return;
    }
    // Reset the item so the next processing pass treats it as fresh.
    set((state) => ({
      queue: state.queue.map((q) =>
        q.id === id ? { ...q, status: 'pending' as const, retries: 0 } : q,
      ),
    }));
    await persistState(get());
    await get().processQueue();
  },

  discardItem: (id) => {
    set((state) => ({ queue: state.queue.filter((q) => q.id !== id) }));
    void persistState(get());
  },

  getQueueLength: () => get().queue.length,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedQueue>;
      set({
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      });
    } catch {
      // A corrupt payload should not crash startup; start with an empty queue.
      set({ queue: [], completedIds: [] });
    }
  },
}));

/**
 * Attempt to replay a single operation, retrying with exponential backoff up to
 * `op.maxRetries` times. Updates the live `retries`/`status` on the stored item
 * so the UI can reflect progress. Returns `true` on success, `false` once all
 * retries are exhausted.
 */
async function replayWithRetries(
  op: QueuedOperation,
  set: (
    partial:
      | Partial<OfflineQueueState>
      | ((state: OfflineQueueState) => Partial<OfflineQueueState>),
  ) => void,
  get: () => OfflineQueueState,
): Promise<boolean> {
  let attempt = 0;

  // Mark the item as actively processing.
  set((state) => ({
    queue: state.queue.map((q) =>
      q.id === op.id ? { ...q, status: 'processing' as const } : q,
    ),
  }));

  for (;;) {
    try {
      await runtime.executor(op);
      return true;
    } catch {
      attempt += 1;

      // Record the attempt count on the stored item for UI/diagnostics.
      set((state) => ({
        queue: state.queue.map((q) => (q.id === op.id ? { ...q, retries: attempt } : q)),
      }));

      if (attempt > op.maxRetries) {
        return false;
      }

      // Exponential backoff before the next retry (1s, 2s, 4s by default).
      await runtime.sleep(runtime.backoff(attempt));
    }
  }
}

// ---------------------------------------------------------------------------
// Connectivity wiring.
// ---------------------------------------------------------------------------

/** Holder for the NetInfo unsubscribe callback so listeners are not duplicated. */
let netInfoUnsubscribe: (() => void) | null = null;

/**
 * Determine from a NetInfo state whether the device is online enough to attempt
 * replaying queued operations. `isInternetReachable` may be `null` while it is
 * being determined; we treat unknown-but-connected as online to avoid stalling.
 */
function isOnline(state: NetInfoState): boolean {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

/**
 * Hydrate the persisted queue and start listening for connectivity changes.
 * When the device transitions back online the queue is processed automatically.
 *
 * Call once during app bootstrap. Returns an unsubscribe function.
 */
export async function initOfflineQueue(): Promise<() => void> {
  await useOfflineQueue.getState().hydrate();

  // Avoid registering duplicate listeners across hot reloads / re-inits.
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (isOnline(state) && useOfflineQueue.getState().getQueueLength() > 0) {
      void useOfflineQueue.getState().processQueue();
    }
  });

  return () => {
    netInfoUnsubscribe?.();
    netInfoUnsubscribe = null;
  };
}

export default useOfflineQueue;
