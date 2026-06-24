/**
 * In-memory token blacklist for session invalidation.
 * For MVP purposes, this uses a Set stored in memory.
 * Can be upgraded to Redis for production use.
 */

const blacklistedTokens: Set<string> = new Set();

/**
 * Add a token to the blacklist, invalidating it for future use.
 */
export function addToBlacklist(token: string): void {
  blacklistedTokens.add(token);
}

/**
 * Check if a token has been blacklisted (i.e., logged out).
 */
export function isBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token);
}
