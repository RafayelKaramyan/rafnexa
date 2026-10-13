import { createContext, useContext } from 'react';
import type { Session } from '@rafnexa/shared';

export type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
  establish: (session: Session) => void;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
};
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('SessionProvider is required.');
  return value;
}
export function useSession() {
  const { session } = useAuth();
  if (!session) throw new Error('An authenticated session is required.');
  return session;
}
