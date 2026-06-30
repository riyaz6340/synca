/**
 * Tests for BiometricScreen — the biometric unlock gate.
 *
 * Covers the gate's full behavior contract:
 *  - auto-prompts on mount when biometrics are available
 *  - calls onAuthenticated when the prompt succeeds
 *  - shows "Try again" on failure and re-invokes the prompt when tapped
 *  - the "Use password instead" fallback triggers onFallback (logout)
 *  - gracefully degrades to credential login when biometrics are unavailable
 *    (e.g. enrollment removed since login), hiding the pointless retry
 *
 * The biometric service is mocked so no native module is touched.
 *
 * Validates: Requirements 1.8, 1.9
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import BiometricScreen from './BiometricScreen';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/services/biometric', () => ({
  biometric: {
    authenticate: jest.fn(),
    checkAvailability: jest.fn(),
  },
}));

import { biometric } from '@/services/biometric';
import type { BiometricAvailability } from '@/services/biometric';

const mockBiometric = biometric as jest.Mocked<typeof biometric>;

const AVAILABLE: BiometricAvailability = { available: true, supportedTypes: [] };
const UNAVAILABLE: BiometricAvailability = {
  available: false,
  reason: 'not_enrolled',
  supportedTypes: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBiometric.checkAvailability.mockResolvedValue({ ...AVAILABLE });
  mockBiometric.authenticate.mockResolvedValue(true);
});

describe('BiometricScreen', () => {
  it('auto-prompts on mount and calls onAuthenticated on success', async () => {
    const onAuthenticated = jest.fn();
    const onFallback = jest.fn();

    render(
      <BiometricScreen
        onAuthenticated={onAuthenticated}
        onFallback={onFallback}
      />,
    );

    await waitFor(() => {
      expect(mockBiometric.authenticate).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('shows "Try again" when the prompt fails', async () => {
    mockBiometric.authenticate.mockResolvedValue(false);
    const onAuthenticated = jest.fn();

    render(
      <BiometricScreen onAuthenticated={onAuthenticated} onFallback={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeOnTheScreen();
    });
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.getByText('Use password instead')).toBeOnTheScreen();
  });

  it('re-invokes the prompt when "Try again" is tapped', async () => {
    // First attempt fails, second attempt succeeds.
    mockBiometric.authenticate
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onAuthenticated = jest.fn();

    render(
      <BiometricScreen onAuthenticated={onAuthenticated} onFallback={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText('Try again'));

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
    expect(mockBiometric.authenticate).toHaveBeenCalledTimes(2);
  });

  it('triggers onFallback when "Use password instead" is tapped', async () => {
    mockBiometric.authenticate.mockResolvedValue(false);
    const onFallback = jest.fn();

    render(
      <BiometricScreen onAuthenticated={jest.fn()} onFallback={onFallback} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Use password instead')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText('Use password instead'));

    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back to credential login when biometrics are unavailable', async () => {
    mockBiometric.checkAvailability.mockResolvedValue({ ...UNAVAILABLE });
    const onAuthenticated = jest.fn();
    const onFallback = jest.fn();

    render(
      <BiometricScreen
        onAuthenticated={onAuthenticated}
        onFallback={onFallback}
      />,
    );

    // Offers the credential fallback and never invokes the (useless) prompt.
    await waitFor(() => {
      expect(screen.getByText('Use password instead')).toBeOnTheScreen();
    });
    expect(mockBiometric.authenticate).not.toHaveBeenCalled();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(onAuthenticated).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Use password instead'));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
});
