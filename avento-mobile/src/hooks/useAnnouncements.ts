/**
 * React Query hooks for parent announcements.
 *
 * `useAnnouncementsQuery` fetches the announcement list from the portal API.
 * `useUnseenAnnouncementCount` derives the unread badge count (Requirement 5.4)
 * by combining that list with the persisted "last seen" timestamp.
 *
 * The shared {@link ANNOUNCEMENTS_QUERY_KEY} lets the list screen, detail
 * screen, and the tab badge all read from a single cached query.
 *
 * Validates: Requirements 5.1, 5.4
 */
import { useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { portalApi } from '@/api/portal';
import { countUnseen, getLastSeenAt } from '@/services/announcementsSeen';
import type { Announcement } from '@/types/models';

/** Shared React Query key for the parent announcement list. */
export const ANNOUNCEMENTS_QUERY_KEY = ['portal', 'announcements'] as const;

/** Fetch the parent's announcements (raw order from the API). */
export function useAnnouncementsQuery(): UseQueryResult<Announcement[], Error> {
  return useQuery({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    queryFn: () => portalApi.getAnnouncements(),
  });
}

/**
 * Derive the count of announcements the parent has not yet seen.
 *
 * Returns 0 while loading or on error so the tab badge stays hidden until we
 * have real data. Re-reads the persisted last-seen timestamp whenever the
 * announcement data changes (e.g. after the list screen marks them seen).
 */
export function useUnseenAnnouncementCount(): number {
  const { data } = useAnnouncementsQuery();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLastSeenAt().then((value) => {
      if (active) setLastSeenAt(value);
    });
    return () => {
      active = false;
    };
  }, [data]);

  if (!data) return 0;
  return countUnseen(data, lastSeenAt);
}
