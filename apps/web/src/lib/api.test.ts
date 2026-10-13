// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());
describe('HTTP boundary', () => {
  it('uses same-origin cookies and a CSRF header for mutations', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'task' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await api('/tasks', { method: 'POST', body: { title: 'Ship it' }, csrfToken: 'token' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'token',
          'Content-Type': 'application/json',
        }),
        body: '{"title":"Ship it"}',
      }),
    );
  });
  it('preserves field feedback and conflict information from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Refresh and try again.',
              requestId: 'request-id',
            },
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(api('/tasks')).rejects.toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      requestId: 'request-id',
    });
  });
  it('does not expose an unexpected HTML error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>private server details</html>', { status: 503 })),
    );
    await expect(api('/projects')).rejects.toBeInstanceOf(ApiError);
  });
});
