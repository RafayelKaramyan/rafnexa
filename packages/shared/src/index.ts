import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const projectStatusSchema = z.enum(['planned', 'active', 'at_risk', 'completed']);
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'in_review', 'done']);
export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type Role = z.infer<typeof roleSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
const name = z.string().trim().min(2).max(80);
const id = z.uuid();
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const date = z.iso.date();
const password = z.string().min(12).max(128);
const token = z.string().regex(/^[a-f0-9]{64}$/);

export const registerSchema = z
  .object({
    name,
    email,
    password,
    workspaceName: name.optional(),
    invitationToken: token.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.workspaceName) !== Boolean(value.invitationToken), {
    message: 'Provide a workspace name or an invitation.',
    path: ['workspaceName'],
  });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const clientInputSchema = z
  .object({
    name,
    contactEmail: email.nullable(),
    description: z.string().trim().max(500).default(''),
  })
  .strict();
export const projectInputSchema = z
  .object({
    name,
    clientId: id.nullable(),
    status: projectStatusSchema,
    dueDate: date.nullable(),
    description: z.string().trim().max(1000).default(''),
  })
  .strict();
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    projectId: id,
    assigneeId: id.nullable(),
    status: taskStatusSchema,
    priority: prioritySchema,
    dueDate: date.nullable(),
  })
  .strict();
export const taskUpdateSchema = taskInputSchema
  .omit({ projectId: true })
  .partial()
  .extend({
    version: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, 'No changes provided.');
export const invitationInputSchema = z
  .object({ email, role: z.enum(['admin', 'member', 'viewer']) })
  .strict();
export const acceptInvitationSchema = z.object({ token }).strict();
export const memberUpdateSchema = z
  .object({ role: z.enum(['admin', 'member', 'viewer']) })
  .strict();
export const switchWorkspaceSchema = z.object({ workspaceId: id }).strict();
export const projectQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(''),
    status: projectStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
export const idSchema = id;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type ProjectQuery = z.infer<typeof projectQuerySchema>;
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export type User = { id: string; name: string; email: string };
export type Workspace = { id: string; name: string; role: Role; isDemo: boolean };
export type Session = {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  csrfToken: string;
};
export type Client = ClientInput & { id: string; createdAt: string };
export type Project = ProjectInput & {
  id: string;
  clientName: string | null;
  ownerName: string;
  ownerId: string;
  taskCount: number;
  completedTasks: number;
  progress: number;
  createdAt: string;
};
export type Task = TaskInput & {
  id: string;
  assigneeName: string | null;
  version: number;
  updatedAt: string;
};
export type Member = User & { role: Role };
export type Invitation = {
  id: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  expiresAt: string;
};
export type InvitationDetails = {
  workspaceName: string;
  email: string;
  role: Exclude<Role, 'owner'>;
};
export type Activity = { id: string; actorName: string; message: string; createdAt: string };
export type Dashboard = {
  activeProjects: number;
  openTasks: number;
  dueThisWeek: number;
  atRisk: number;
  throughput: { week: string; completed: number }[];
  milestones: Project[];
  projects: Project[];
  activity: Activity[];
};
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ApiErrorBody = {
  error: { code: string; message: string; requestId?: string; fields?: Record<string, string> };
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  at_risk: 'At risk',
  completed: 'Completed',
};
export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
};
export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};
export function canManage(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}
export function canEditTask(role: Role, userId: string, assigneeId: string | null): boolean {
  return canManage(role) || (role === 'member' && assigneeId === userId);
}
