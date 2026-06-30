/**
 * API client and infrastructure types for the Avento mobile app.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import type { AppUser } from './auth';

/** Configuration for the axios-based API client */
export interface ApiClientConfig {
  baseURL: string;        // https://avento-api.onrender.com
  timeout: number;        // default 30_000ms
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  /**
   * Optional accessor for the active organization id. When provided, its
   * resolved value is attached to every request as the `organization_id`
   * header. Injected (rather than importing the session store directly) so the
   * API client stays decoupled from auth/secure-storage modules.
   */
  getOrganizationId?: () => Promise<string | null> | string | null;
}

/** A single queued write operation for offline resilience */
export interface QueuedOperation {
  id: string;             // UUID
  timestamp: number;      // Date.now() when queued
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed';
}

/** Zustand offline queue store state and actions */
export interface OfflineQueueStore {
  queue: QueuedOperation[];
  isProcessing: boolean;

  enqueue: (op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries' | 'status'>) => void;
  processQueue: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  discardItem: (id: string) => void;
  getQueueLength: () => number;
}

/** Generic cache entry stored in AsyncStorage */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;      // Date.now() timestamp
  key: string;            // cache key (e.g., 'children_list', 'attendance_2024-01-15')
}

/** Session data stored in SecureStore */
export interface SecureSession {
  token: string;
  user: AppUser;
  biometricEnabled: boolean;
}
