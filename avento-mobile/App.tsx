import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { GlobalOfflineBanner } from '@/components/GlobalOfflineBanner';
import { RootWarningBanner } from '@/components/RootWarningBanner';
import { initOnlineManager, queryClient } from '@/lib/queryClient';
import { initQueryPersistence } from '@/lib/queryPersistence';
import RootNavigator from '@/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    // Bridge connectivity into React Query (drives refetchOnReconnect).
    const disposeOnlineManager = initOnlineManager();

    // Hydrate the cache from AsyncStorage and persist successful results so
    // each screen shows last-fetched data immediately, then background-refreshes.
    let disposePersistence: (() => void) | undefined;
    void initQueryPersistence(queryClient).then((dispose) => {
      disposePersistence = dispose;
    });

    return () => {
      disposeOnlineManager();
      disposePersistence?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <GlobalOfflineBanner />
        <RootWarningBanner />
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
