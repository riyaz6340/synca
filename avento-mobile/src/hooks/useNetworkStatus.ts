/**
 * `useNetworkStatus` — subscribe to device connectivity via NetInfo and expose
 * a simple `isOffline` flag for UI (offline banners, retry affordances, etc.).
 *
 * Backs the app-wide offline indicator (Requirement 21.1) and is the single
 * source of truth screens use to decide whether to show cached-data warnings.
 *
 * Validates: Requirements 21.1, 21.5
 */
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Decide whether a NetInfo state represents an offline device.
 *
 * Pure and exported so it can be unit-tested without React. We treat the device
 * as offline only when connectivity is explicitly absent: `isConnected` is
 * false, or internet reachability is explicitly `false`. While reachability is
 * still being determined (`null`) we optimistically report online to avoid a
 * flash of the offline banner on launch.
 */
export function isOfflineState(state: NetInfoState): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** React hook returning the current offline status, updating on changes. */
export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let active = true;

    // Seed with the current state so the banner is correct on first render.
    void NetInfo.fetch().then((state) => {
      if (active) {
        setIsOffline(isOfflineState(state));
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(isOfflineState(state));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { isOffline };
}

export default useNetworkStatus;
