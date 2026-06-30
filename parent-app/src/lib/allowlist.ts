/**
 * Path allowlist guard — ensures the app only sends requests to permitted API paths.
 *
 * Validates: Requirements 9.1, 9.5
 */

/** The set of permitted API path prefixes. */
export const ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/portal',
  '/api/leave-requests',
  '/api/organization',
  '/api/persons',
  '/api/groups',
  '/api/attendance',
  '/api/notifications',
  '/api/announcements',
  '/api/reports',
  '/api/holidays',
  '/api/super-admin',
  '/api/channels',
  '/api/audit-logs',
] as const;

/**
 * Custom error thrown when a request targets a disallowed path.
 */
export class DisallowedRequestError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`Request to disallowed path blocked: ${path}`);
    this.name = 'DisallowedRequestError';
    this.path = path;
  }
}

/**
 * Normalize a URL/path string to just the pathname for prefix matching.
 * Strips query strings, fragments, and collapses consecutive slashes.
 */
function normalizePath(path: string): string {
  // Remove query string and fragment
  let normalized = path.split('?')[0].split('#')[0];

  // Collapse consecutive slashes into a single slash
  normalized = normalized.replace(/\/+/g, '/');

  // Remove trailing slash (unless it's the root "/")
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Returns true if the given path begins with one of the allowed prefixes.
 * The path is normalized before checking (query strings, fragments, and
 * redundant slashes are stripped).
 */
export function isAllowedPath(path: string): boolean {
  const normalized = normalizePath(path);
  return ALLOWED_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(prefix + '/'),
  );
}

/**
 * Throws DisallowedRequestError if the path does not match an allowed prefix.
 * Used by the API client request interceptor to block disallowed requests
 * before they are sent.
 */
export function assertAllowedPath(path: string): void {
  if (!isAllowedPath(path)) {
    throw new DisallowedRequestError(path);
  }
}
