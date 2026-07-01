/**
 * Unit tests for the getDisplayName helper used by mobile dashboard screens
 * to resolve organization display names with graceful fallback.
 *
 * Validates: Requirements 4.4
 */
import { getDisplayName } from '../getDisplayName';

describe('getDisplayName', () => {
  it('returns "My School" for null', () => {
    expect(getDisplayName(null)).toBe('My School');
  });

  it('returns "My School" for undefined', () => {
    expect(getDisplayName(undefined)).toBe('My School');
  });

  it('returns "My School" for an empty string', () => {
    expect(getDisplayName('')).toBe('My School');
  });

  it('returns "My School" for a whitespace-only string', () => {
    expect(getDisplayName('   ')).toBe('My School');
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
