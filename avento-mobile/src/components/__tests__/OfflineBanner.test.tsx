/**
 * Unit tests for OfflineBanner — verifies it renders the outdated-data warning
 * only when offline (Requirements 3.5, 21.1).
 */
import React from 'react';

import { renderWithProviders, screen } from '../../__tests__/utils/renderWithProviders';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner', () => {
  it('renders a warning when offline', () => {
    renderWithProviders(<OfflineBanner offline />);
    expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
    expect(screen.getByText(/cached data that may be outdated/i)).toBeOnTheScreen();
  });

  it('renders nothing when online', () => {
    renderWithProviders(<OfflineBanner offline={false} />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('supports a custom message', () => {
    renderWithProviders(<OfflineBanner offline message="No connection" />);
    expect(screen.getByText('No connection')).toBeOnTheScreen();
  });
});
