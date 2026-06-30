/**
 * Unit tests for EmptyState — renders the message and (optionally) an action
 * button that invokes the provided callback.
 */
import React from 'react';

import {
  fireEvent,
  renderWithProviders,
  screen,
} from '../../__tests__/utils/renderWithProviders';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and message', () => {
    renderWithProviders(<EmptyState title="Nothing here" message="No records found" />);
    expect(screen.getByText('Nothing here')).toBeOnTheScreen();
    expect(screen.getByText('No records found')).toBeOnTheScreen();
  });

  it('renders no action button when onAction is not provided', () => {
    renderWithProviders(<EmptyState message="No records found" />);
    expect(screen.queryByTestId('empty-state-action')).toBeNull();
  });

  it('invokes the action callback when the button is pressed', () => {
    const onAction = jest.fn();
    renderWithProviders(
      <EmptyState message="No records found" actionLabel="Add" onAction={onAction} />
    );
    fireEvent.press(screen.getByTestId('empty-state-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
