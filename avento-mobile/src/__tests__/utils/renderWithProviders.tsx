/**
 * Test rendering utilities.
 *
 * `renderWithProviders` wraps a component under test in the same context
 * providers the real app uses (React Query's QueryClientProvider, and room to
 * add navigation/auth providers later) so screens and hooks can be exercised
 * realistically.
 *
 * It re-exports everything from `@testing-library/react-native`, so test files
 * can import `renderWithProviders`, `screen`, `fireEvent`, `waitFor`, etc. all
 * from this single module.
 */
import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Create a QueryClient tuned for tests: retries disabled and caching turned off
 * so assertions are deterministic and don't leak state across tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Provide a custom QueryClient (otherwise a fresh test client is created). */
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export the testing-library API so tests have a single import source.
export * from '@testing-library/react-native';
