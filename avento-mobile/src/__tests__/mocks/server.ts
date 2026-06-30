/**
 * MSW server instance for Node-based (Jest) test environments.
 *
 * Usage in a test file:
 *
 *   import { server } from '@/__tests__/mocks/server';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const server = setupServer(...handlers);
