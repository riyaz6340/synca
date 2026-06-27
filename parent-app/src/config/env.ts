/**
 * Config Loader — reads the backend base URL exclusively from the app's own
 * environment configuration. Throws ConfigError at startup if the value is
 * missing, empty, or whitespace-only (fail-fast, no hardcoded fallback).
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Reads and validates `VITE_API_URL` from the Vite environment.
 * @returns The trimmed backend API base URL.
 * @throws {ConfigError} If the value is missing, empty, or whitespace-only.
 */
export function loadApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;

  if (raw == null || raw.trim() === '') {
    throw new ConfigError(
      'Backend API base URL is not configured. Set VITE_API_URL in the environment.'
    );
  }

  return raw.trim();
}
