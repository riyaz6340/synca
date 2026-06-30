/**
 * Unit tests for the offline queue manager (Zustand store).
 *
 * Covers enqueue (UUID + timestamp), chronological processing order,
 * idempotent re-processing, retry/backoff behavior, and manual
 * retry/discard actions. The operation executor, backoff and persistence are
 * injected so the tests run deterministically without network/timers/storage.
 */

import {
  useOfflineQueue,
  configureOfflineQueue,
  resetOfflineQueueConfig,
  orderQueue,
  DEFAULT_MAX_RETRIES,
} from './offlineQueue';
import type { QueuedOperation } from '@/types/api';

/** Reset the store and injected deps before each test. */
function resetStore(): void {
  useOfflineQueue.setState({ queue: [], isProcessing: false, completedIds: [] });
  resetOfflineQueueConfig();
}

/** Minimal op input for enqueue (id/timestamp/retries/status are derived). */
const sampleOp = (overrides: Partial<Omit<QueuedOperation, 'id' | 'timestamp' | 'retries' | 'status'>> = {}) => ({
  method: 'POST' as const,
  url: '/api/attendance/bulk',
  body: { foo: 'bar' },
  maxRetries: DEFAULT_MAX_RETRIES,
  ...overrides,
});

describe('offlineQueue store', () => {
  beforeEach(() => {
    resetStore();
    // Make persistence a no-op and backoff instant for deterministic tests.
    configureOfflineQueue({
      persister: async () => {},
      backoff: () => 0,
      sleep: async () => {},
    });
  });

  describe('enqueue', () => {
    it('assigns a unique id, timestamp, zeroed retries and pending status', () => {
      const before = Date.now();
      useOfflineQueue.getState().enqueue(sampleOp());
      const after = Date.now();

      const { queue } = useOfflineQueue.getState();
      expect(queue).toHaveLength(1);
      const op = queue[0];
      expect(op.id).toMatch(/[0-9a-f-]{36}/);
      expect(op.timestamp).toBeGreaterThanOrEqual(before);
      expect(op.timestamp).toBeLessThanOrEqual(after);
      expect(op.retries).toBe(0);
      expect(op.status).toBe('pending');
      expect(op.maxRetries).toBe(DEFAULT_MAX_RETRIES);
    });

    it('generates distinct ids for each enqueued operation', () => {
      useOfflineQueue.getState().enqueue(sampleOp());
      useOfflineQueue.getState().enqueue(sampleOp());
      const { queue } = useOfflineQueue.getState();
      expect(queue[0].id).not.toBe(queue[1].id);
    });
  });

  describe('orderQueue', () => {
    it('orders by timestamp and breaks ties by insertion order (stable)', () => {
      const ops: QueuedOperation[] = [
        { id: 'a', timestamp: 200, method: 'POST', url: '/a', body: null, retries: 0, maxRetries: 3, status: 'pending' },
        { id: 'b', timestamp: 100, method: 'POST', url: '/b', body: null, retries: 0, maxRetries: 3, status: 'pending' },
        { id: 'c', timestamp: 100, method: 'POST', url: '/c', body: null, retries: 0, maxRetries: 3, status: 'pending' },
      ];
      expect(orderQueue(ops).map((o) => o.id)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('processQueue', () => {
    it('executes operations in chronological order', async () => {
      const calls: string[] = [];
      configureOfflineQueue({
        persister: async () => {},
        backoff: () => 0,
        sleep: async () => {},
        executor: async (op) => {
          calls.push(op.url);
        },
      });

      // Enqueue with explicit timestamps out of insertion order.
      useOfflineQueue.setState({
        queue: [
          { id: '1', timestamp: 300, method: 'POST', url: '/third', body: null, retries: 0, maxRetries: 3, status: 'pending' },
          { id: '2', timestamp: 100, method: 'POST', url: '/first', body: null, retries: 0, maxRetries: 3, status: 'pending' },
          { id: '3', timestamp: 200, method: 'POST', url: '/second', body: null, retries: 0, maxRetries: 3, status: 'pending' },
        ],
        completedIds: [],
        isProcessing: false,
      });

      await useOfflineQueue.getState().processQueue();

      expect(calls).toEqual(['/first', '/second', '/third']);
      expect(useOfflineQueue.getState().queue).toHaveLength(0);
    });

    it('removes successful operations and records them as completed', async () => {
      configureOfflineQueue({ persister: async () => {}, backoff: () => 0, sleep: async () => {}, executor: async () => {} });
      useOfflineQueue.getState().enqueue(sampleOp());
      const id = useOfflineQueue.getState().queue[0].id;

      await useOfflineQueue.getState().processQueue();

      expect(useOfflineQueue.getState().queue).toHaveLength(0);
      expect(useOfflineQueue.getState().completedIds).toContain(id);
    });

    it('does not re-submit operations that already succeeded (idempotent)', async () => {
      let executions = 0;
      configureOfflineQueue({
        persister: async () => {},
        backoff: () => 0,
        sleep: async () => {},
        executor: async () => {
          executions += 1;
        },
      });

      useOfflineQueue.getState().enqueue(sampleOp());
      await useOfflineQueue.getState().processQueue();
      // Process again — nothing left, no duplicate submission.
      await useOfflineQueue.getState().processQueue();

      expect(executions).toBe(1);
    });

    it('skips an operation whose id is already in completedIds', async () => {
      let executions = 0;
      configureOfflineQueue({
        persister: async () => {},
        backoff: () => 0,
        sleep: async () => {},
        executor: async () => {
          executions += 1;
        },
      });

      // Seed a queue item whose id is already marked completed.
      useOfflineQueue.setState({
        queue: [
          { id: 'done', timestamp: 1, method: 'POST', url: '/x', body: null, retries: 0, maxRetries: 3, status: 'pending' },
        ],
        completedIds: ['done'],
        isProcessing: false,
      });

      await useOfflineQueue.getState().processQueue();

      expect(executions).toBe(0);
      expect(useOfflineQueue.getState().queue).toHaveLength(0);
    });
  });

  describe('retry/backoff', () => {
    it('retries up to maxRetries times then marks the item failed', async () => {
      let attempts = 0;
      const delays: number[] = [];
      configureOfflineQueue({
        persister: async () => {},
        backoff: (attempt) => 1000 * 2 ** (attempt - 1),
        sleep: async (ms) => {
          delays.push(ms);
        },
        executor: async () => {
          attempts += 1;
          throw new Error('network down');
        },
      });

      useOfflineQueue.getState().enqueue(sampleOp({ maxRetries: 3 }));
      await useOfflineQueue.getState().processQueue();

      // Initial attempt + 3 retries = 4 executions.
      expect(attempts).toBe(4);
      // Backoff delays applied between retries: 1s, 2s, 4s.
      expect(delays).toEqual([1000, 2000, 4000]);

      const item = useOfflineQueue.getState().queue[0];
      expect(item.status).toBe('failed');
      expect(item.retries).toBe(4);
      expect(useOfflineQueue.getState().completedIds).not.toContain(item.id);
    });

    it('succeeds on a later attempt and clears the item', async () => {
      let attempts = 0;
      configureOfflineQueue({
        persister: async () => {},
        backoff: () => 0,
        sleep: async () => {},
        executor: async () => {
          attempts += 1;
          if (attempts < 2) {
            throw new Error('transient');
          }
        },
      });

      useOfflineQueue.getState().enqueue(sampleOp());
      await useOfflineQueue.getState().processQueue();

      expect(attempts).toBe(2);
      expect(useOfflineQueue.getState().queue).toHaveLength(0);
    });
  });

  describe('manual actions', () => {
    it('discardItem removes a specific operation', () => {
      useOfflineQueue.getState().enqueue(sampleOp());
      useOfflineQueue.getState().enqueue(sampleOp({ url: '/other' }));
      const [first] = useOfflineQueue.getState().queue;

      useOfflineQueue.getState().discardItem(first.id);

      const { queue } = useOfflineQueue.getState();
      expect(queue).toHaveLength(1);
      expect(queue.find((q) => q.id === first.id)).toBeUndefined();
    });

    it('retryItem resets a failed item and reprocesses it', async () => {
      let shouldFail = true;
      configureOfflineQueue({
        persister: async () => {},
        backoff: () => 0,
        sleep: async () => {},
        executor: async () => {
          if (shouldFail) {
            throw new Error('down');
          }
        },
      });

      useOfflineQueue.getState().enqueue(sampleOp({ maxRetries: 0 }));
      await useOfflineQueue.getState().processQueue();
      const failed = useOfflineQueue.getState().queue[0];
      expect(failed.status).toBe('failed');

      // Network recovers; manual retry should now succeed.
      shouldFail = false;
      await useOfflineQueue.getState().retryItem(failed.id);

      expect(useOfflineQueue.getState().queue).toHaveLength(0);
    });

    it('getQueueLength reflects the number of pending operations', () => {
      expect(useOfflineQueue.getState().getQueueLength()).toBe(0);
      useOfflineQueue.getState().enqueue(sampleOp());
      expect(useOfflineQueue.getState().getQueueLength()).toBe(1);
    });
  });
});
