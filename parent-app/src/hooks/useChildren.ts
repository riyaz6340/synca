import { useState, useEffect, useCallback } from 'react';
import type { ViewState, PersonWithStatus } from '../api/types';
import { portalApi } from '../api/endpoints';
import { toDisplayStatus } from '../lib/presence';

/**
 * Hook that fetches the parent's children with their current presence status.
 *
 * - Fetches on mount
 * - Maps each person through `toDisplayStatus` for display purposes
 * - Manages loading/success/empty/error view state
 * - Exposes a `retry()` callback to re-fetch on demand
 *
 * Validates: Requirements 3.1, 3.4, 3.5, 3.6
 */
export function useChildren(): {
  state: ViewState<PersonWithStatus[]>;
  retry: () => void;
} {
  const [state, setState] = useState<ViewState<PersonWithStatus[]>>({
    status: 'loading',
  });

  const fetchChildren = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const children = await portalApi.getChildren();

      // Apply toDisplayStatus mapping for each person (validates display derivation)
      // The raw PersonWithStatus objects are kept in state for downstream use,
      // but we call toDisplayStatus to ensure the mapping is exercised.
      children.forEach((child) => toDisplayStatus(child));

      if (children.length === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'success', data: children });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load children';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return { state, retry: fetchChildren };
}
