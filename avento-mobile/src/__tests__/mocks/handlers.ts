/**
 * MSW (Mock Service Worker) request handlers.
 *
 * This is the scaffold of API mocks used by integration tests. Handlers are
 * keyed off the same base URL the real app uses (`ENV.API_URL`) so tests
 * exercise the exact request paths the API client produces.
 *
 * Add handlers here as endpoint modules are implemented (auth, portal, admin,
 * superadmin). Tests can also override individual handlers at runtime via
 * `server.use(...)`.
 */
import { http, HttpResponse } from 'msw';

import { ENV } from '@/config/env';

const API = ENV.API_URL;

export const handlers = [
  // Auth: list organizations for the login dropdown.
  // The backend wraps the list in an `organizations` key.
  http.get(`${API}/api/auth/organizations`, () => {
    return HttpResponse.json({
      organizations: [{ id: 'org-1', name: 'Demo Organization' }],
    });
  }),

  // Auth: login.
  http.post(`${API}/api/auth/login`, () => {
    return HttpResponse.json({
      token: 'test-jwt-token',
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: 'Admin',
        organization_id: 'org-1',
      },
    });
  }),
];
