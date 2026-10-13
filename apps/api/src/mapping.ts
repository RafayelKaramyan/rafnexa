import { projectStatusSchema, taskStatusSchema, prioritySchema, roleSchema } from '@rafnexa/shared';
import type { Client, Member, Project, Task, Workspace, User } from '@rafnexa/shared';
import type { Row } from './db.js';

export function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Invalid database field: ${key}`);
  return value;
}
export function optionalText(row: Row, key: string): string | null {
  return row[key] == null ? null : text(row, key);
}
export function number(row: Row, key: string): number {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`Invalid database field: ${key}`);
  return value;
}
export function timestamp(row: Row, key: string): string {
  return text(row, key).replace(' ', 'T') + 'Z';
}
export function user(row: Row): User {
  return { id: text(row, 'id'), name: text(row, 'name'), email: text(row, 'email') };
}
export function workspace(row: Row): Workspace {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    role: roleSchema.parse(row.role),
    isDemo: Boolean(number(row, 'is_demo')),
  };
}
export function client(row: Row): Client {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    contactEmail: optionalText(row, 'contact_email'),
    description: text(row, 'description'),
    createdAt: timestamp(row, 'created_at'),
  };
}
export function project(row: Row): Project {
  const taskCount = number(row, 'task_count');
  const completedTasks = number(row, 'completed_tasks');
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    clientId: optionalText(row, 'client_id'),
    clientName: optionalText(row, 'client_name'),
    ownerId: text(row, 'owner_id'),
    ownerName: text(row, 'owner_name'),
    status: projectStatusSchema.parse(row.status),
    dueDate: optionalText(row, 'due_date'),
    taskCount,
    completedTasks,
    progress: taskCount ? Math.round((completedTasks / taskCount) * 100) : 0,
    createdAt: timestamp(row, 'created_at'),
  };
}
export function task(row: Row): Task {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    projectId: text(row, 'project_id'),
    assigneeId: optionalText(row, 'assignee_id'),
    assigneeName: optionalText(row, 'assignee_name'),
    status: taskStatusSchema.parse(row.status),
    priority: prioritySchema.parse(row.priority),
    dueDate: optionalText(row, 'due_date'),
    version: number(row, 'version'),
    updatedAt: timestamp(row, 'updated_at'),
  };
}
export function member(row: Row): Member {
  return { ...user(row), role: roleSchema.parse(row.role) };
}
