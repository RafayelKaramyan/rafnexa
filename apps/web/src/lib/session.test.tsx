// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@rafnexa/shared';
import { SessionProvider } from './session';
import { useAuth } from './session-context';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('updates the active session observer while removing previous workspace data', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'SESSION_EXPIRED', message: 'Sign in.' } }), {
          status: 401,
        }),
      ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['previous-workspace', 'projects'], [{ name: 'Previous private data' }]);
  const session: Session = {
    user: { id: 'user', name: 'Rafayel', email: 'raf@example.com' },
    workspace: { id: 'new-workspace', name: 'Studio', role: 'owner', isDemo: false },
    workspaces: [{ id: 'new-workspace', name: 'Studio', role: 'owner', isDemo: false }],
    csrfToken: 'token',
  };
  function Probe() {
    const auth = useAuth();
    return (
      <>
        <span>{auth.loading ? 'Loading' : (auth.session?.user.name ?? 'Signed out')}</span>
        <button onClick={() => auth.establish(session)}>Open workspace</button>
      </>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  await screen.findByText('Signed out');
  await userEvent.click(screen.getByRole('button', { name: 'Open workspace' }));
  expect(await screen.findByText('Rafayel')).toBeVisible();
  expect(client.getQueryData(['previous-workspace', 'projects'])).toBeUndefined();
});
