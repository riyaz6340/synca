/**
 * API Client — single axios instance with interceptors for auth token
 * attachment, path allowlist enforcement, and 401 handling.
 *
 * Validates: Requirements 2.3, 2.5, 9.1, 9.5, 8.6
 */

import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { loadApiBaseUrl } from '../config/env';
import { assertAllowedPath } from '../lib/allowlist';

// ---------------------------------------------------------------------------
// Token management (module-level)
// ---------------------------------------------------------------------------

let _token: string | null = null;

/** Returns the currently held auth token, or null. */
export function getToken(): string | null {
  return _token;
}

/** Stores the auth token for subsequent requests. */
export function setToken(token: string | null): void {
  _token = token;
}

/** Clears the held auth token. */
export function clearToken(): void {
  _token = null;
}

// ---------------------------------------------------------------------------
// Timeout presets (milliseconds)
// ---------------------------------------------------------------------------

/** 5 s — presence view requests. */
export const TIMEOUT_PRESENCE = 5_000;

/** 10 s — attendance and announcements requests. */
export const TIMEOUT_MEDIUM = 10_000;

/** 30 s — auth and default requests. */
export const TIMEOUT_DEFAULT = 30_000;

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const apiClient = axios.create({
  baseURL: loadApiBaseUrl(),
  timeout: TIMEOUT_DEFAULT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptors
// ---------------------------------------------------------------------------

// 1. Attach Authorization header when a token is held (Req 2.3)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 2. Enforce path allowlist on every outgoing request (Req 9.1, 9.5)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Build the path to validate — use the url property (relative to baseURL)
    const path = config.url ?? '';
    assertAllowedPath(path);
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

// On 401: clear token and redirect to login within 1 second (Req 2.5)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken();
      setTimeout(() => {
        window.location.href = '/login';
      }, 1_000);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
