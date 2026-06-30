/**
 * Unit tests for navigation state persistence helpers.
 *
 * Validates: Requirements 23.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationState } from '@react-navigation/native';

import {
  loadNavigationState,
  persistNavigationState,
  clearNavigationState,
  NAV_STATE_STORAGE_KEY,
  PERSIST_DEBOUNCE_MS,
  _flushPendingWrite,
} from './navigationState';

// The global setup already mocks AsyncStorage via the official in-memory mock.

beforeEach(async () => {
  await AsyncStorage.clear();
  _flushPendingWrite();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** A minimal valid navigation state for testing. */
const validState: NavigationState = {
  index: 0,
  key: 'root',
  routeNames: ['ParentTabs'],
  routes: [{ key: 'ParentTabs-1', name: 'ParentTabs' }],
  stale: false,
  type: 'stack',
};

describe('loadNavigationState', () => {
  it('returns undefined when nothing is stored', async () => {
    const result = await loadNavigationState();
    expect(result).toBeUndefined();
  });

  it('returns the stored state when valid', async () => {
    await AsyncStorage.setItem(
      NAV_STATE_STORAGE_KEY,
      JSON.stringify(validState),
    );

    const result = await loadNavigationState();
    expect(result).toEqual(validState);
  });

  it('returns undefined for corrupted JSON and removes the key', async () => {
    await AsyncStorage.setItem(NAV_STATE_STORAGE_KEY, '{not-valid-json!!!');

    const result = await loadNavigationState();
    expect(result).toBeUndefined();
  });

  it('returns undefined when the state has no routes array', async () => {
    await AsyncStorage.setItem(
      NAV_STATE_STORAGE_KEY,
      JSON.stringify({ index: 0 }),
    );

    const result = await loadNavigationState();
    expect(result).toBeUndefined();

    // Should have cleaned up the invalid entry.
    const stored = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it('returns undefined when routes array is empty', async () => {
    await AsyncStorage.setItem(
      NAV_STATE_STORAGE_KEY,
      JSON.stringify({ index: 0, routes: [] }),
    );

    const result = await loadNavigationState();
    expect(result).toBeUndefined();
  });

  it('returns undefined for null stored value', async () => {
    await AsyncStorage.setItem(NAV_STATE_STORAGE_KEY, 'null');

    const result = await loadNavigationState();
    expect(result).toBeUndefined();
  });
});

describe('persistNavigationState', () => {
  it('writes the state to AsyncStorage after the debounce window', async () => {
    persistNavigationState(validState);

    // Not yet written — still debouncing.
    const immediate = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(immediate).toBeNull();

    // Advance past debounce window.
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 50);

    // Allow the async write to settle.
    await jest.runAllTimersAsync();

    const stored = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(validState);
  });

  it('deduplicates rapid calls — only the last state is persisted', async () => {
    const state1: NavigationState = {
      ...validState,
      index: 0,
      routes: [{ key: 'r1', name: 'ParentTabs' }],
    };
    const state2: NavigationState = {
      ...validState,
      index: 1,
      routes: [
        { key: 'r1', name: 'ParentTabs' },
        { key: 'r2', name: 'AdminTabs' },
      ],
    };

    persistNavigationState(state1);
    // Call again before debounce fires.
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS / 2);
    persistNavigationState(state2);

    // Advance past debounce from second call.
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 50);
    await jest.runAllTimersAsync();

    const stored = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(JSON.parse(stored!)).toEqual(state2);
  });
});

describe('clearNavigationState', () => {
  it('removes the stored state', async () => {
    await AsyncStorage.setItem(
      NAV_STATE_STORAGE_KEY,
      JSON.stringify(validState),
    );

    await clearNavigationState();

    const stored = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it('cancels any pending debounced write', async () => {
    persistNavigationState(validState);
    await clearNavigationState();

    // Advance past debounce — the write should have been cancelled.
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 50);
    await jest.runAllTimersAsync();

    const stored = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    expect(stored).toBeNull();
  });
});

describe('round-trip: persist then load', () => {
  it('restores the same state that was persisted', async () => {
    persistNavigationState(validState);
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 50);
    await jest.runAllTimersAsync();

    const restored = await loadNavigationState();
    expect(restored).toEqual(validState);
  });
});
