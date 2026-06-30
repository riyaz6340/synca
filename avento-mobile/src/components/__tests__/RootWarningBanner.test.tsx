/**
 * Unit tests for RootWarningBanner — verifies the banner shows when root
 * detection returns true and renders nothing when it returns false.
 *
 * The root detection service is injectable/mockable via `_setDetector` and
 * `_resetDetector`, allowing deterministic testing without native modules.
 *
 * Validates: Requirement 20.5
 */
import React from 'react';

import {
  renderWithProviders,
  screen,
  waitFor,
} from '../../__tests__/utils/renderWithProviders';
import { _resetDetector, _setDetector } from '../../services/rootDetection';
import { RootWarningBanner } from '../RootWarningBanner';

describe('RootWarningBanner', () => {
  afterEach(() => {
    _resetDetector();
  });

  it('renders the warning banner when the device is rooted', async () => {
    _setDetector(async () => true);

    renderWithProviders(<RootWarningBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('root-warning-banner')).toBeOnTheScreen();
    });
    expect(
      screen.getByText(
        'This device appears to be rooted. Your data may be less secure.'
      )
    ).toBeOnTheScreen();
  });

  it('renders nothing when the device is not rooted', async () => {
    _setDetector(async () => false);

    renderWithProviders(<RootWarningBanner />);

    // Give the async effect time to resolve
    await waitFor(() => {
      expect(screen.queryByTestId('root-warning-banner')).toBeNull();
    });
  });

  it('renders nothing by default (no native detector available)', async () => {
    // Default detector returns false
    _resetDetector();

    renderWithProviders(<RootWarningBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('root-warning-banner')).toBeNull();
    });
  });
});
