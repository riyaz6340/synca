/**
 * GlobalOfflineBanner — app-level offline indicator.
 *
 * Subscribes to device connectivity via {@link useNetworkStatus} and renders
 * the presentational {@link OfflineBanner} whenever the device is offline. This
 * is mounted once at the app root so every screen shows a consistent
 * "showing cached data" warning while offline (Requirement 21.1).
 *
 * Kept as a thin, standalone component (no navigation/query coupling) so it can
 * be mounted in App.tsx without conflicting with other in-flight work on the
 * navigation tree, and so it is trivial to test by mocking NetInfo.
 *
 * Validates: Requirements 21.1, 21.5
 */
import React from 'react';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { OfflineBanner } from './OfflineBanner';

export interface GlobalOfflineBannerProps {
  /** Optional override message forwarded to the underlying banner. */
  message?: string;
  testID?: string;
}

export function GlobalOfflineBanner({
  message,
  testID,
}: GlobalOfflineBannerProps = {}): React.ReactElement | null {
  const { isOffline } = useNetworkStatus();
  return <OfflineBanner offline={isOffline} message={message} testID={testID} />;
}

export default GlobalOfflineBanner;
