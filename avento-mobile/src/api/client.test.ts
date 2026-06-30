/**
 * Unit tests for the axios API client interceptors.
 *
 * Covers: Bearer token attachment, organization_id header attachment,
 * 401 -> onUnauthorized logout flow, and network/timeout -> OfflineError.
 *
 * Uses MSW to mock the HTTP layer so requests exercise the real interceptor
 * stack against deterministic responses.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { createApiClient, OfflineError, DEFAULT_TIMEOUT } from './client';
import { ENV } from '@/config/env';

const API = ENV.API_URL;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createApiClient request interceptors', () => {
  it('attaches the Bearer token from getToken to outgoing requests', async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${API}/api/ping`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient({
      getToken: async () => 'jwt-abc-123',
    });

    await client.get('/api/ping');

    expect(receivedAuth).toBe('Bearer jwt-abc-123');
  });

  it('does not attach an Authorization header when no token is available', async () => {
    let hasAuth = true;
    server.use(
      http.get(`${API}/api/ping`, ({ request }) => {
        hasAuth = request.headers.has('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient({
      getToken: async () => null,
    });

    await client.get('/api/ping');

    expect(hasAuth).toBe(false);
  });

  it('attaches the organization_id header from getOrganizationId', async () => {
    let receivedOrg: string | null = null;
    server.use(
      http.get(`${API}/api/ping`, ({ request }) => {
        receivedOrg = request.headers.get('organization_id');
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient({
      getToken: async () => 'token',
      getOrganizationId: async () => 'org-42',
    });

    await client.get('/api/ping');

    expect(receivedOrg).toBe('org-42');
  });
});

describe('createApiClient response interceptors', () => {
  it('invokes onUnauthorized when the server responds with 401', async () => {
    server.use(
      http.get(`${API}/api/secure`, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const onUnauthorized = jest.fn();
    const client = createApiClient({
      getToken: async () => 'expired-token',
      onUnauthorized,
    });

    await expect(client.get('/api/secure')).rejects.toBeDefined();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onUnauthorized for non-401 error responses', async () => {
    server.use(
      http.get(`${API}/api/boom`, () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );

    const onUnauthorized = jest.fn();
    const client = createApiClient({
      getToken: async () => 'token',
      onUnauthorized,
    });

    await expect(client.get('/api/boom')).rejects.toBeDefined();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('rejects with a typed OfflineError on a network failure', async () => {
    server.use(
      http.get(`${API}/api/ping`, () => HttpResponse.error()),
    );

    const client = createApiClient({ getToken: async () => null });

    await expect(client.get('/api/ping')).rejects.toBeInstanceOf(OfflineError);
  });

  it('rejects with a typed OfflineError when the request times out', async () => {
    server.use(
      http.get(`${API}/api/slow`, async () => {
        // Delay longer than the client timeout to force an abort.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient({
      getToken: async () => null,
      timeout: 10,
    });

    const error = await client.get('/api/slow').catch((e) => e);
    expect(error).toBeInstanceOf(OfflineError);
    expect((error as OfflineError).isOffline).toBe(true);
  });
});

describe('client configuration defaults', () => {
  it('uses ENV.API_URL and the 30s default timeout', () => {
    const client = createApiClient();
    expect(client.defaults.baseURL).toBe(ENV.API_URL);
    expect(client.defaults.timeout).toBe(DEFAULT_TIMEOUT);
    expect(DEFAULT_TIMEOUT).toBe(30_000);
  });
});
