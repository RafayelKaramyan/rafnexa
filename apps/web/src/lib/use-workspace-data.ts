import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client, Member, Page, Project } from '@rafnexa/shared';
import { useSession } from './session-context';
import { api } from './api';

export function useClients() {
  const session = useSession();
  return useQuery({
    queryKey: [session.workspace.id, 'clients'],
    queryFn: ({ signal }) => api<Client[]>('/clients', { signal }),
  });
}
export function useMembers() {
  const session = useSession();
  return useQuery({
    queryKey: [session.workspace.id, 'members'],
    queryFn: ({ signal }) => api<Member[]>('/members', { signal }),
  });
}
export function useProjectOptions() {
  const session = useSession();
  return useQuery({
    queryKey: [session.workspace.id, 'project-options'],
    queryFn: async ({ signal }) => {
      const first = await api<Page<Project>>('/projects?page=1&pageSize=50', { signal });
      const remaining = await Promise.all(
        Array.from({ length: Math.ceil(first.total / 50) - 1 }, (_, index) =>
          api<Page<Project>>(`/projects?page=${index + 2}&pageSize=50`, { signal }),
        ),
      );
      return [first, ...remaining].flatMap((page) => page.items);
    },
  });
}
export function useInvalidateWorkspace() {
  const session = useSession();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [session.workspace.id] });
}
