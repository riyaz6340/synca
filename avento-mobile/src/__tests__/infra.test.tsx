/**
 * Sanity tests that verify the testing infrastructure is wired correctly:
 *  - Jest + TypeScript run.
 *  - fast-check property tests run with the project's 100-iteration minimum.
 *  - React Native components render through the shared provider wrapper.
 */
import React from 'react';
import { Text } from 'react-native';
import fc from 'fast-check';

import { renderWithProviders, screen } from './utils/renderWithProviders';

describe('testing infrastructure', () => {
  it('runs basic Jest assertions', () => {
    expect(1 + 1).toBe(2);
  });

  // Feature: native-mobile-app — sanity property to confirm fast-check works.
  it('runs fast-check property tests with at least 100 iterations', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 }
    );
  });

  it('renders a React Native component within app providers', () => {
    renderWithProviders(<Text>Arixx Mobile</Text>);
    expect(screen.getByText('Arixx Mobile')).toBeOnTheScreen();
  });
});
