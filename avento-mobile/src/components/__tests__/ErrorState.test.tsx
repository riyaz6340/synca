/**
 * Unit tests for ErrorState — renders an error message and a retry button that
 * invokes the provided callback (Requirement 3.5).
 */
import React from 'react';

import {
  fireEvent,
  renderWithProviders,
  screen,
} from '../../__tests__/utils/renderWithProviders';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders a default error message', () => {
    renderWithProviders(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });

  it('renders a custom message', () => {
    renderWithProviders(<ErrorState message="Failed to load children" />);
    expect(screen.getByText('Failed to load children')).toBeOnTheScreen();
  });

  it('shows no retry button when onRetry is omitted', () => {
    renderWithProviders(<ErrorState />);
    expect(screen.queryByTestId('error-state-retry')).toBeNull();
  });

  it('invokes the retry callback when the retry button is pressed', () => {
    const onRetry = jest.fn();
    renderWithProviders(<ErrorState onRetry={onRetry} />);
    fireEvent.press(screen.getByTestId('error-state-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
