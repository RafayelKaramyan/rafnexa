import { useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Session } from '@rafnexa/shared';
import { api, ApiError } from './api';
import { AuthContext } from './session-context';
import { demoStorageKey, isLocalDemo } from './demo-config';

function clearWorkspaceQueries(client: QueryClient) {
  void client.cancelQueries();
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      try {
        return await api<Session>('/auth/session', { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    const expired = () => {
      clearWorkspaceQueries(client);
      client.setQueryData(['session'], null);
    };
    window.addEventListener('rafnexa:session-expired', expired);
    return () => window.removeEventListener('rafnexa:session-expired', expired);
  }, [client]);
  useEffect(() => {
    if (!isLocalDemo) return;
    const refresh = (event: StorageEvent) => {
      if (event.key === demoStorageKey || event.key === null) {
        void client.invalidateQueries();
      }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [client]);
  function establish(session: Session) {
    clearWorkspaceQueries(client);
    client.setQueryData(['session'], session);
  }
  async function logout() {
    if (query.data)
      await api('/auth/logout', { method: 'POST', body: {}, csrfToken: query.data.csrfToken });
    clearWorkspaceQueries(client);
    client.setQueryData(['session'], null);
  }
  async function switchWorkspace(workspaceId: string) {
    if (!query.data) return;
    const next = await api<Session>('/auth/switch', {
      method: 'POST',
      body: { workspaceId },
      csrfToken: query.data.csrfToken,
    });
    establish(next);
  }
  return (
    <AuthContext.Provider
      value={{
        session: query.data ?? null,
        loading: query.isPending,
        error: query.error,
        retry: () => {
          void query.refetch();
        },
        establish,
        logout,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
