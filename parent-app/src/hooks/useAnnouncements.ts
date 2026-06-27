/**
 * Hook: useAnnouncements
 * Fetches announcements on mount, sorts by published date descending,
 * and manages loading/success/empty/error view state with retry support.
 *
 * Validates: Requirements 5.1, 5.3, 5.4, 5.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ViewState, Announcement } from '../api/types';
import { portalApi } from '../api/endpoints';
import { sortAnnouncementsByPublishedDesc } from '../lib/sorting';

export function useAnnouncements(): {
  state: ViewState<Announcement[]>;
  retry: () => void;
} {
  const [state, setState] = useState<ViewState<Announcement[]>>({ status: 'loading' });
  const isMounted = useRef(true);

  const fetchAnnouncements = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const announcements = await portalApi.getAnnouncements();

      if (!isMounted.current) return;

      if (announcements.length === 0) {
        setState({ status: 'empty' });
      } else {
        const sorted = sortAnnouncementsByPublishedDesc(announcements);
        setState({ status: 'success', data: sorted });
      }
    } catch (error: unknown) {
      if (!isMounted.current) return;

      const message =
        error instanceof Error ? error.message : 'Failed to load announcements';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchAnnouncements();

    return () => {
      isMounted.current = false;
    };
  }, [fetchAnnouncements]);

  const retry = useCallback(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { state, retry };
}
