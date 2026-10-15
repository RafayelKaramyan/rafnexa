// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, Dashboard, Page, Project, Session, Task } from '@rafnexa/shared';
import { requestLocalDemo as request } from './local-demo';
import { demoStorageKey } from './demo-config';

const input = { name: 'Launch review', clientId: null, status: 'active', dueDate: null };
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('persistent portfolio workspace', () => {
  it('starts without credentials and retains projects across fresh module loads', async () => {
    const session = await request<Session>('/auth/session');
    expect(session.workspace.isDemo).toBe(true);
    const project = await request<Project>('/projects', { method: 'POST', body: input });
    vi.resetModules();
    const fresh = await import('./local-demo');
    expect((await fresh.requestLocalDemo<Project>(`/projects/${project.id}`)).name).toBe(
      'Launch review',
    );
    const filtered = await fresh.requestLocalDemo<Page<Project>>(
      '/projects?q=launch&status=active&page=1&pageSize=1',
    );
    expect(filtered.items.map((item) => item.id)).toEqual([project.id]);
    expect(filtered.total).toBe(1);
  });
  it('persists task moves, derives progress and rejects stale writes', async () => {
    const project = await request<Project>('/projects', { method: 'POST', body: input });
    const completedBefore = (await request<Dashboard>('/dashboard')).throughput.at(-1)!.completed;
    const task = await request<Task>('/tasks', {
      method: 'POST',
      body: {
        title: 'Review delivery',
        projectId: project.id,
        assigneeId: null,
        status: 'todo',
        priority: 'high',
        dueDate: null,
      },
    });
    const moved = await request<Task>(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: { version: task.version, status: 'done' },
    });
    expect(moved.version).toBe(2);
    expect((await request<Project>(`/projects/${project.id}`)).progress).toBe(100);
    await expect(
      request(`/tasks/${task.id}`, { method: 'PATCH', body: { version: 1, status: 'todo' } }),
    ).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
    expect((await request<Task[]>(`/projects/${project.id}/tasks`))[0]?.status).toBe('done');
    expect((await request<Dashboard>('/dashboard')).throughput.at(-1)?.completed).toBe(
      completedBefore + 1,
    );
    await request(`/tasks/${task.id}`, { method: 'DELETE', body: { version: moved.version } });
    expect((await request<Project>(`/projects/${project.id}`)).taskCount).toBe(0);
    expect((await request<Dashboard>('/dashboard')).throughput.at(-1)?.completed).toBe(
      completedBefore,
    );
  });
  it('checks client references before archiving', async () => {
    const client = await request<Client>('/clients', {
      method: 'POST',
      body: { name: 'North studio', contactEmail: null },
    });
    const project = await request<Project>('/projects', {
      method: 'POST',
      body: { ...input, clientId: client.id },
    });
    await expect(request(`/clients/${client.id}`, { method: 'DELETE' })).rejects.toMatchObject({
      status: 409,
    });
    await request(`/projects/${project.id}`, { method: 'DELETE' });
    await request(`/clients/${client.id}`, { method: 'DELETE' });
    expect((await request<Client[]>('/clients')).some((c) => c.id === client.id)).toBe(false);
    await expect(request(`/projects/${project.id}/tasks`)).rejects.toMatchObject({ status: 404 });
  });
  it('validates input, protects the owner and never simulates registration', async () => {
    await expect(
      request('/projects', { method: 'POST', body: { ...input, name: 'x' } }),
    ).rejects.toMatchObject({ status: 422, fields: { name: expect.any(String) } });
    const session = await request<Session>('/auth/session');
    await expect(
      request(`/members/${session.user.id}`, { method: 'PATCH', body: { role: 'viewer' } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(request('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'LOCAL_DEMO_ONLY',
    });
  });
  it('preserves unreadable data until an explicit reset', async () => {
    localStorage.setItem(demoStorageKey, '{broken');
    await expect(request('/auth/session')).rejects.toMatchObject({ code: 'DEMO_DATA_INVALID' });
    expect(localStorage.getItem(demoStorageKey)).toBe('{broken');
    expect((await request<Session>('/demo/reset', { method: 'POST' })).workspace.name).toBe(
      'Studio workspace',
    );
    expect((await request<Page<Project>>('/projects')).total).toBe(6);
  });
  it('reports failed persistence without claiming a successful write', async () => {
    await request('/auth/session');
    const before = localStorage.getItem(demoStorageKey);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(request('/projects', { method: 'POST', body: input })).rejects.toMatchObject({
      code: 'DEMO_STORAGE_UNAVAILABLE',
    });
    expect(localStorage.getItem(demoStorageKey)).toBe(before);
  });
});
