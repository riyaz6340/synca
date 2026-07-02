/**
 * Axios-based API client for the Arixx mobile app.
 *
 * Responsibilities:
 *  - Centralize the base URL (from `EXPO_PUBLIC_API_URL` via `ENV.API_URL`).
 *  - Attach the Bearer token to every request (token retrieval is *injected*
 *    via a `getToken` callback so this module never imports the secure-storage
 *    service directly — keeping the service layer decoupled).
 *  - Attach the active `organization_id` header when an accessor is provided.
 *  - Translate auth failures (401) into a logout flow via `onUnauthorized`.
 *  - Translate network/timeout failures into a typed `OfflineError` so callers
 *    (offline queue, React Query) can branch on connectivity loss.
 *
 * Validates: Requirements 1.2, 1.6, 24.3
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ENV } from '@/config/env';
import type { ApiClientConfig } from '@/types/api';

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 30_000;

/**
 * Error thrown when a request fails due to lost connectivity or a timeout
 * (i.e. the server was never reached, or did not respond in time). Distinct
 * from HTTP error responses, which carry a status code.
 */
export class OfflineError extends Error {
  /** Discriminant flag for cheap `instanceof`-free checks at call sites. */
  readonly isOffline = true as const;

  /** The underlying axios/network error, retained for diagnostics. */
  readonly originalError?: unknown;

  constructor(message = 'No network connection. Please try again.', originalError?: unknown) {
    super(message);
    this.name = 'OfflineError';
    this.originalError = originalError;
    // Restore the prototype chain (required when targeting ES5/TS downlevel)
    // so `instanceof OfflineError` works as expected.
    Object.setPrototypeOf(this, OfflineError.prototype);
  }
}

/** Options accepted by {@link createApiClient}. All fields are optional. */
export type CreateApiClientOptions = Partial<ApiClientConfig>;

/**
 * Determine whether an axios error represents a connectivity/timeout failure
 * (no HTTP response was received) as opposed to a server-side error response.
 */
function isOfflineError(error: AxiosError): boolean {
  // A timeout aborts the request with code ECONNABORTED (or ETIMEDOUT).
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  // axios marks low-level network failures with ERR_NETWORK.
  if (error.code === 'ERR_NETWORK') {
    return true;
  }
  // No response object means the request never reached / heard back from the
  // server — treat as offline. (When a response exists it is an HTTP error.)
  return !error.response;
}

/**
 * Create a configured axios instance with the Arixx interceptor stack.
 *
 * Dependencies (`getToken`, `getOrganizationId`, `onUnauthorized`) are injected
 * so the client can be wired up once the auth store / secure storage service
 * are available, without creating an import cycle.
 */
export function createApiClient(options: CreateApiClientOptions = {}): AxiosInstance {
  const {
    baseURL = ENV.API_URL,
    timeout = DEFAULT_TIMEOUT,
    getToken,
    getOrganizationId,
    onUnauthorized,
  } = options;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // --- Request interceptor: attach auth token + organization_id header ---
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (getToken) {
        const token = await getToken();
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      }

      if (getOrganizationId) {
        const orgId = await getOrganizationId();
        if (orgId) {
          config.headers.set('organization_id', orgId);
        }
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  // --- Response interceptor: 401 -> logout, network/timeout -> OfflineError ---
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        onUnauthorized?.();
        return Promise.reject(error);
      }

      if (isOfflineError(error)) {
        return Promise.reject(new OfflineError(undefined, error));
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

/**
 * Mutable holder for the injected dependencies of the default client. These are
 * set via {@link configureApiClient} once the auth/secure-storage layers exist.
 */
const runtimeConfig: {
  getToken?: () => Promise<string | null>;
  getOrganizationId?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
} = {};

/**
 * The shared application API client. Its interceptors read from
 * {@link runtimeConfig}, so callbacks can be injected after construction.
 */
export const apiClient: AxiosInstance = createApiClient({
  getToken: () => (runtimeConfig.getToken ? runtimeConfig.getToken() : Promise.resolve(null)),
  getOrganizationId: () =>
    runtimeConfig.getOrganizationId ? runtimeConfig.getOrganizationId() : null,
  onUnauthorized: () => runtimeConfig.onUnauthorized?.(),
});

/**
 * Inject runtime dependencies into the shared {@link apiClient}. Call this once
 * during app bootstrap (e.g. after the auth store and secure storage service
 * are initialized).
 */
export function configureApiClient(config: {
  getToken?: () => Promise<string | null>;
  getOrganizationId?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}): void {
  if (config.getToken) runtimeConfig.getToken = config.getToken;
  if (config.getOrganizationId) runtimeConfig.getOrganizationId = config.getOrganizationId;
  if (config.onUnauthorized) runtimeConfig.onUnauthorized = config.onUnauthorized;
}

export default apiClient;
