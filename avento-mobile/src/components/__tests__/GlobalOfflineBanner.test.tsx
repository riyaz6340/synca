/**
 * Unit tests for GlobalOfflineBanner — verifies it wires NetInfo connectivity
 * to the presentational OfflineBanner: the warning shows when the device is
 * offline, stays hidden when online, and reacts to live connectivity changes.
 *
 * NetInfo is mocked globally (see __tests__/setup); here we drive its
 * `fetch`/`addEventListener` per test.
 *
 * Validates: Requirements 21.1, 21.5
 */
import React from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import {
  act,
  renderWithProviders,
  screen,
  waitFor,
} from '../../__tests__/utils/renderWithProviders';
import { GlobalOfflineBanner } from '../GlobalOfflineBanner';

const mockFetch = NetInfo.fetch as jest.Mock;
const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

/** Build a partial NetInfoState; cast since tests only use connectivity flags. */
function netState(isConnected: boolean, isInternetReachable: boolean | null): NetInfoState {
  return { isConnected, isInternetReachable } as NetInfoState;
}

describe('GlobalOfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddEventListener.mockReturnValue(() => {});
    mockFetch.mockResolvedValue(netState(true, true));
  });

  it('renders the offline banner when the device starts offline', async () => {
    mockFetch.mockResolvedValue(netState(false, false));

    renderWithProviders(<GlobalOfflineBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
    });
  });

  it('renders nothing when the device is online', async () => {
    mockFetch.mockResolvedValue(netState(true, true));

    renderWithProviders(<GlobalOfflineBanner />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('shows the banner when a connectivity change reports offline', async () => {
    mockFetch.mockResolvedValue(netState(true, true));
    let listener: (state: NetInfoState) => void = () => {};
    mockAddEventListener.mockImplementation((cb: (state: NetInfoState) => void) => {
      listener = cb;
      return () => {};
    });

    renderWithProviders(<GlobalOfflineBanner />);

    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('offline-banner')).toBeNull();

    act(() => {
      listener(netState(false, false));
    });

    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
    });
  });
});
