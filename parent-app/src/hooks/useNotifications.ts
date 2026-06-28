import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification, ViewState } from '../api/types';
import { portalApi } from '../api/endpoints';
import { sortNotificationsByEffectiveDateDesc } from '../lib/sorting';

const PAGE_SIZE = 20;

interface UseNotificationsResult {
  state: ViewState<Notification[]>;
  notifications: Notification[];
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Hook to fetch and paginate notifications.
 *
 * - Fetches first page on mount (page 1, limit 20)
 * - Accumulates notifications across pages
 * - loadMore() fetches the next page and appends
 * - On error during loadMore, retains previously loaded data
 * - Sorts all accumulated notifications by effective date descending
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [state, setState] = useState<ViewState<Notification[]>>({ status: 'loading' });
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const loadedRef = useRef(false);

  const fetchPage = useCallback(async (page: number) => {
    const isInitial = !loadedRef.current;

    if (isInitial) {
      setState({ status: 'loading' });
    }

    try {
      const result = await portalApi.getNotifications(page, PAGE_SIZE);
      const newItems = result.data;
      const totalPages = result.pagination.totalPages;

      setNotifications((prev) => {
        const accumulated = isInitial ? newItems : [...prev, ...newItems];
        return sortNotificationsByEffectiveDateDesc(accumulated);
      });

      setHasMore(page < totalPages);
      pageRef.current = page;
      loadedRef.current = true;

      // Determine success vs empty for the initial load
      if (isInitial && newItems.length === 0) {
        setState({ status: 'empty' });
      } else {
        // Use a micro-task to ensure setNotifications has applied
        setNotifications((current) => {
          setState({ status: 'success', data: current });
          return current;
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Notifications could not be loaded';

      // Retain previously loaded notifications on error (Req 6.6)
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    fetchPage(pageRef.current + 1);
  }, [hasMore, fetchPage]);

  const retry = useCallback(() => {
    if (!loadedRef.current) {
      // No data has been loaded yet — retry initial load
      fetchPage(1);
    } else {
      // Retry loading the next page
      fetchPage(pageRef.current + 1);
    }
  }, [fetchPage]);

  return { state, notifications, hasMore, loadMore, retry };
}
