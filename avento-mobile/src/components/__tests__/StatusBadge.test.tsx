/**
 * Unit tests for StatusBadge — verifies the status → color/label mapping
 * required by Requirement 3.2.
 */
import React from 'react';

import { renderWithProviders, screen } from '../../__tests__/utils/renderWithProviders';
import { StatusBadge } from '../StatusBadge';
import { colors } from '../theme';

type Case = {
  status: React.ComponentProps<typeof StatusBadge>['status'];
  label: string;
  color: string;
};

const cases: Case[] = [
  { status: 'Present', label: 'Present', color: colors.present },
  { status: 'Absent', label: 'Absent', color: colors.absent },
  { status: 'Late', label: 'Late', color: colors.late },
  { status: 'On_Leave', label: 'On Leave', color: colors.onLeave },
  { status: 'Not yet marked', label: 'Not Marked', color: colors.notMarked },
  { status: 'Not Marked', label: 'Not Marked', color: colors.notMarked },
  { status: null, label: 'Not Marked', color: colors.notMarked },
];

describe('StatusBadge', () => {
  it.each(cases)('maps %p to the correct label and color', ({ status, label, color }) => {
    renderWithProviders(<StatusBadge status={status} testID="badge" />);

    // Label is rendered.
    expect(screen.getByText(label)).toBeOnTheScreen();

    // Background color matches the palette for that status.
    const badge = screen.getByTestId('badge');
    const flattened = Array.isArray(badge.props.style)
      ? Object.assign({}, ...badge.props.style.flat())
      : badge.props.style;
    expect(flattened.backgroundColor).toBe(color);
  });

  it('renders a custom label override', () => {
    renderWithProviders(<StatusBadge status="Present" label="Here" />);
    expect(screen.getByText('Here')).toBeOnTheScreen();
  });
});
