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
  const isInitialLoadRef = useRef(true);

  const fetchPage = useCallback(async (page: number, isInitial: boolean) => {
    setState(isInitial ? { status: 'loading' } : (prev) => prev);

    try {
      const result = await portalApi.getNotifications(page, PAGE_SIZE);
      const newNotifications = result.data;

      setNotifications((prev) => {
        const accumulated = isInitial ? newNotifications : [...prev, ...newNotifications];
        const sorted = sortNotificationsByEffectiveDateDesc(accumulated);
        return sorted;
      });

      const totalPages = result.pagination.totalPages;
      setHasMore(page < totalPages);
      pageRef.current = page;
      isInitialLoadRef.current = false;

      // Determine state after accumulation
      if (isInitial && newNotifications.length === 0) {
        setState({ status: 'empty' });
      } else {
        // We use a callback to get the latest accumulated value
        setNotifications((current) => {
          setState({ status: 'success', data: current });
          return current;
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Notifications could not be loaded';

      if (isInitial && notifications.length === 0) {
        // No previous data — show error state
        setState({ status: 'error', message });
      } else {
        // Retain previously loaded notifications on error (Req 6.6)
        setState({ status: 'error', message });
      }
    }
  }, []);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    const nextPage = pageRef.current + 1;
    fetchPage(nextPage, false);
  }, [hasMore, fetchPage]);

  const retry = useCallback(() => {
    if (isInitialLoadRef.current) {
      // Retry from the beginning
      setNotifications([]);
      fetchPage(1, true);
    } else {
      // Retry the last failed page
      const retryPage = pageRef.current + 1;
      fetchPage(retryPage, false);
    }
  }, [fetchPage]);

  return { state, notifications, hasMore, loadMore, retry };
}
