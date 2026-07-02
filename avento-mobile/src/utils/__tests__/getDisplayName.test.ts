/**
 * Unit tests for the getDisplayName helper used by mobile dashboard screens
 * to resolve organization display names with graceful fallback.
 *
 * Validates: Requirements 4.4
 */
import { getDisplayName } from '../getDisplayName';

describe('getDisplayName', () => {
  it('returns "My Institution" for null', () => {
    expect(getDisplayName(null)).toBe('My Institution');
  });

  it('returns "My Institution" for undefined', () => {
    expect(getDisplayName(undefined)).toBe('My Institution');
  });

  it('returns "My Institution" for an empty string', () => {
    expect(getDisplayName('')).toBe('My Institution');
  });

  it('returns "My Institution" for a whitespace-only string', () => {
    expect(getDisplayName('   ')).toBe('My Institution');
  });

  it('returns the trimmed name for a valid string', () => {
    expect(getDisplayName('Greenwood High')).toBe('Greenwood High');
  });

  it('trims leading and trailing whitespace from valid names', () => {
    expect(getDisplayName('  Riverside Academy  ')).toBe('Riverside Academy');
  });

  it('returns a single character name as-is', () => {
    expect(getDisplayName('A')).toBe('A');
  });
});
