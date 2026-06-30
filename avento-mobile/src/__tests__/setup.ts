/**
 * Global Jest setup, executed once per test file before the suite runs.
 *
 * `@testing-library/react-native` (v12.4+) registers its Jest matchers
 * automatically when imported here, so component tests can use matchers like
 * `toBeOnTheScreen()` and `toHaveTextContent()` without extra wiring.
 */
import '@testing-library/react-native/extend-expect';

/**
 * Mock native modules that have no implementation under the Jest (Node)
 * environment. AsyncStorage ships an official in-memory mock; NetInfo is
 * stubbed with a connected default state and a no-op listener so modules that
 * import them (e.g. the offline queue manager) can be unit/property tested.
 */
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => {}),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
}));
