/**
 * Unit tests for the AsyncStorage-backed React Query persistence layer.
 *
 * Verifies the persist → hydrate round-trip restores successful query data into
 * a fresh client, that snapshots older than the max age are discarded, that a
 * corrupt payload is ignored without throwing, and that the cache can be
 * cleared. AsyncStorage uses the official in-memory mock (see __tests__/setup).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import {
  QUERY_CACHE_STORAGE_KEY,
  MAX_PERSISTED_AGE_MS,
  clearPersistedQueryCache,
  hydrateQueryClient,
  persistQueryClient,
} from './queryPersistence';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

describe('queryPersistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists successful query data and restores it into a fresh client', async () => {
    const source = makeClient();
    source.setQueryData(['persons'], [{ id: '1', name: 'Ada' }]);

    await persistQueryClient(source, 1_000);

    const raw = await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    expect(raw).not.toBeNull();

    const target = makeClient();
    await hydrateQueryClient(target, 1_000);

    expect(target.getQueryData(['persons'])).toEqual([{ id: '1', name: 'Ada' }]);
  });

  it('discards a snapshot older than the maximum age', async () => {
    const source = makeClient();
    source.setQueryData(['dashboard'], { present: 12 });
    await persistQueryClient(source, 0);

    const target = makeClient();
    await hydrateQueryClient(target, MAX_PERSISTED_AGE_MS + 1);

    expect(target.getQueryData(['dashboard'])).toBeUndefined();
    expect(await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('restores a snapshot that is within the maximum age', async () => {
    const source = makeClient();
    source.setQueryData(['announcements'], ['a', 'b']);
    await persistQueryClient(source, 0);

    const target = makeClient();
    await hydrateQueryClient(target, MAX_PERSISTED_AGE_MS - 1);

    expect(target.getQueryData(['announcements'])).toEqual(['a', 'b']);
  });

  it('ignores a corrupt payload without throwing', async () => {
    await AsyncStorage.setItem(QUERY_CACHE_STORAGE_KEY, 'not-json{');

    const target = makeClient();
    await expect(hydrateQueryClient(target, 0)).resolves.toBeUndefined();
    expect(target.getQueryData(['anything'])).toBeUndefined();
  });

  it('does nothing when there is no persisted snapshot', async () => {
    const target = makeClient();
    await expect(hydrateQueryClient(target, 0)).resolves.toBeUndefined();
    expect(target.getQueryData(['anything'])).toBeUndefined();
  });

  it('clears the persisted snapshot', async () => {
    const source = makeClient();
    source.setQueryData(['k'], 1);
    await persistQueryClient(source, 0);
    expect(await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

    await clearPersistedQueryCache();
    expect(await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });
});
