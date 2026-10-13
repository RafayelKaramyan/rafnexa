import { describe, expect, it } from 'vitest';
import {
  canEditTask,
  canManage,
  projectInputSchema,
  registerSchema,
  taskUpdateSchema,
  projectQuerySchema,
} from './index.js';

describe('API contracts and permissions', () => {
  it('rejects tenant IDs and unknown fields supplied by a client', () => {
    expect(
      projectInputSchema.safeParse({
        name: 'New portal',
        clientId: null,
        status: 'active',
        dueDate: null,
        workspaceId: 'spoofed',
      }).success,
    ).toBe(false);
  });
  it('requires a workspace or a valid invitation when registering', () => {
    expect(
      registerSchema.safeParse({
        name: 'Rafayel',
        email: 'raf@example.com',
        password: 'strong-password',
      }).success,
    ).toBe(false);
  });
  it('rejects empty and unversioned task changes', () => {
    expect(taskUpdateSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ status: 'done' }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ version: 1, status: 'done' }).success).toBe(true);
  });
  it('bounds pagination and validates real calendar dates', () => {
    expect(projectQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(
      projectInputSchema.safeParse({
        name: 'Portal',
        clientId: null,
        status: 'active',
        dueDate: '2026-02-31',
      }).success,
    ).toBe(false);
  });
  it('keeps viewers read only and members limited to their assigned tasks', () => {
    expect(canManage('viewer')).toBe(false);
    expect(canEditTask('member', 'me', 'me')).toBe(true);
    expect(canEditTask('member', 'me', 'other')).toBe(false);
    expect(canEditTask('viewer', 'me', 'me')).toBe(false);
    expect(canEditTask('admin', 'me', null)).toBe(true);
  });
});
