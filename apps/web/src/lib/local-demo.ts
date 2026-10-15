import { z } from 'zod';
import {
  clientInputSchema,
  projectInputSchema,
  projectQuerySchema,
  taskInputSchema,
  taskUpdateSchema,
  memberUpdateSchema,
  roleSchema,
  type Activity,
  type Dashboard,
  type Project,
  type Session,
  type Task,
} from '@rafnexa/shared';
import { ApiError } from './api-error';
import type { RequestOptions } from './api';
import { demoStorageKey } from './demo-config';

const uuid = z.uuid();
const timestamp = z.iso.datetime();
const memberSchema = z.object({ id: uuid, name: z.string(), email: z.email(), role: roleSchema });
const storedProject = projectInputSchema.extend({
  id: uuid,
  ownerId: uuid,
  createdAt: timestamp,
  archived: z.boolean(),
});
const storedTask = taskInputSchema.extend({
  id: uuid,
  version: z.number().int().positive(),
  updatedAt: timestamp,
  completedAt: timestamp.nullable(),
  archived: z.boolean(),
});
const stateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  workspace: z.object({
    id: uuid,
    name: z.string(),
    role: z.literal('owner'),
    isDemo: z.literal(true),
  }),
  userId: uuid,
  members: z.array(memberSchema),
  clients: z.array(
    clientInputSchema.extend({ id: uuid, createdAt: timestamp, archived: z.boolean() }),
  ),
  projects: z.array(storedProject),
  tasks: z.array(storedTask),
  activity: z.array(
    z.object({ id: uuid, actorName: z.string(), message: z.string(), createdAt: timestamp }),
  ),
});
type DemoState = z.infer<typeof stateSchema>;
type StoredProject = z.infer<typeof storedProject>;
type StoredTask = z.infer<typeof storedTask>;

function date(offset: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offset);
  return now.toISOString().slice(0, 10);
}
function seed(): DemoState {
  const userId = crypto.randomUUID();
  const members: DemoState['members'] = [
    { id: userId, name: 'Demo visitor', email: 'visitor@demo.rafnexa.example', role: 'owner' },
    {
      id: crypto.randomUUID(),
      name: 'Maya Chen',
      email: 'maya@demo.rafnexa.example',
      role: 'admin',
    },
    {
      id: crypto.randomUUID(),
      name: 'Daniel Reyes',
      email: 'daniel@demo.rafnexa.example',
      role: 'member',
    },
    {
      id: crypto.randomUUID(),
      name: 'Nina Brooks',
      email: 'nina@demo.rafnexa.example',
      role: 'member',
    },
    {
      id: crypto.randomUUID(),
      name: 'Alex Morgan',
      email: 'alex@demo.rafnexa.example',
      role: 'viewer',
    },
  ];
  const clients = ['Studio West', 'Cobalt Works', 'Atlas Collective', 'Oakline'].map((name) => ({
    id: crypto.randomUUID(),
    name,
    contactEmail: null,
    description: 'An independent studio with a clear idea of what comes next.',
    createdAt: new Date().toISOString(),
    archived: false,
  }));
  const samples = [
    {
      name: 'Customer portal',
      client: 0,
      status: 'active',
      due: 5,
      tasks: [
        'Define account flows',
        'Build workspace navigation',
        'Implement profile settings',
        'Review accessibility',
        'Ship account overview',
      ],
    },
    {
      name: 'Design system v2',
      client: 1,
      status: 'active',
      due: 14,
      tasks: [
        'Audit interface patterns',
        'Create token library',
        'Build form components',
        'Document keyboard behavior',
      ],
    },
    {
      name: 'Commerce dashboard',
      client: 2,
      status: 'at_risk',
      due: 2,
      tasks: [
        'Map reporting requirements',
        'Implement filters',
        'Review loading states',
        'Connect reporting API',
      ],
    },
    {
      name: 'Mobile onboarding',
      client: 3,
      status: 'planned',
      due: 21,
      tasks: ['Outline onboarding flow', 'Prototype mobile layout', 'Validate content'],
    },
    {
      name: 'Support workspace',
      client: 0,
      status: 'completed',
      due: -3,
      tasks: ['Build ticket list', 'Add assignment controls', 'Validate responsive behavior'],
    },
    {
      name: 'Partner analytics',
      client: 1,
      status: 'active',
      due: 9,
      tasks: ['Define reporting contract', 'Build analytics panels', 'Test empty states'],
    },
  ] as const;
  const projects: StoredProject[] = [];
  const tasks: StoredTask[] = [];
  const statuses = ['done', 'in_progress', 'in_review', 'todo'] as const;
  for (const [index, sample] of samples.entries()) {
    const projectId = crypto.randomUUID();
    projects.push({
      id: projectId,
      name: sample.name,
      clientId: clients[sample.client]!.id,
      ownerId: members[index % 4]!.id,
      status: sample.status,
      dueDate: date(sample.due),
      description: `A focused delivery project for ${clients[sample.client]!.name}.`,
      createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
      archived: false,
    });
    for (const [taskIndex, title] of sample.tasks.entries()) {
      const status = sample.status === 'completed' ? 'done' : statuses[taskIndex % 4]!;
      tasks.push({
        id: crypto.randomUUID(),
        projectId,
        title,
        assigneeId: members[taskIndex % 4]!.id,
        status,
        priority: taskIndex === 3 ? 'high' : taskIndex === 0 ? 'low' : 'medium',
        dueDate: date(sample.due - taskIndex),
        version: 1,
        archived: false,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'done' ? `${date(-index * 7 - 1)}T12:00:00.000Z` : null,
      });
    }
  }
  return {
    schemaVersion: 1,
    revision: 0,
    workspace: { id: crypto.randomUUID(), name: 'Studio workspace', role: 'owner', isDemo: true },
    userId,
    members,
    clients,
    projects,
    tasks,
    activity: [
      'Moved a task to In review',
      'Created Customer portal',
      'Completed Support workspace',
      'Updated Design system v2',
    ].map((message, index) => ({
      id: crypto.randomUUID(),
      actorName: members[index]!.name,
      message,
      createdAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
    })),
  };
}
function storageError() {
  return new ApiError(
    507,
    'DEMO_STORAGE_UNAVAILABLE',
    'Changes could not be saved. Allow browser storage or free some space, then try again.',
  );
}
function save(state: DemoState) {
  try {
    localStorage.setItem(demoStorageKey, JSON.stringify(state));
  } catch {
    throw storageError();
  }
}
function load(): DemoState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(demoStorageKey);
  } catch {
    throw storageError();
  }
  if (raw === null) {
    const state = seed();
    save(state);
    return state;
  }
  try {
    const result = stateSchema.safeParse(JSON.parse(raw));
    if (
      result.success &&
      result.data.members.some((m) => m.id === result.data.userId && m.role === 'owner')
    )
      return result.data;
  } catch {
    /* Keep unreadable data intact until the visitor chooses Reset demo. */
  }
  throw new ApiError(
    409,
    'DEMO_DATA_INVALID',
    'The saved demo data could not be read. Reset the demo to start fresh.',
  );
}
function validate<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[issue.path.join('.') || 'form'] = issue.message;
  throw new ApiError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields);
}
function session(state: DemoState): Session {
  const member = state.members.find((m) => m.id === state.userId)!;
  return {
    user: { id: member.id, name: member.name, email: member.email },
    workspace: state.workspace,
    workspaces: [state.workspace],
    csrfToken: state.workspace.id,
  };
}
function project(state: DemoState, id: string) {
  const record = state.projects.find((p) => p.id === id && !p.archived);
  if (!record) throw new ApiError(404, 'NOT_FOUND', 'This project is no longer available.');
  return record;
}
function asProject(state: DemoState, record: StoredProject): Project {
  const tasks = state.tasks.filter((t) => t.projectId === record.id && !t.archived);
  const completed = tasks.filter((t) => t.status === 'done').length;
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    clientId: record.clientId,
    status: record.status,
    dueDate: record.dueDate,
    ownerId: record.ownerId,
    createdAt: record.createdAt,
    clientName: state.clients.find((c) => c.id === record.clientId && !c.archived)?.name ?? null,
    ownerName: state.members.find((m) => m.id === record.ownerId)?.name ?? 'Demo visitor',
    taskCount: tasks.length,
    completedTasks: completed,
    progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
function asTask(state: DemoState, record: StoredTask): Task {
  return {
    id: record.id,
    title: record.title,
    projectId: record.projectId,
    assigneeId: record.assigneeId,
    status: record.status,
    priority: record.priority,
    dueDate: record.dueDate,
    version: record.version,
    updatedAt: record.updatedAt,
    assigneeName: state.members.find((m) => m.id === record.assigneeId)?.name ?? null,
  };
}
function log(state: DemoState, message: string) {
  const activity: Activity = {
    id: crypto.randomUUID(),
    actorName: 'Demo visitor',
    message,
    createdAt: new Date().toISOString(),
  };
  state.activity = [activity, ...state.activity].slice(0, 40);
  state.revision++;
  save(state);
}
function checkClient(state: DemoState, id: string | null) {
  if (id !== null && !state.clients.some((c) => c.id === id && !c.archived))
    throw new ApiError(422, 'VALIDATION_ERROR', 'Choose an available client.', {
      clientId: 'This client is unavailable.',
    });
}
function checkAssignee(state: DemoState, id: string | null) {
  if (id !== null && !state.members.some((m) => m.id === id && m.role !== 'viewer'))
    throw new ApiError(422, 'VALIDATION_ERROR', 'Choose an available assignee.', {
      assigneeId: 'Choose a member with task access.',
    });
}
function dashboard(state: DemoState): Dashboard {
  const projects = state.projects.filter((p) => !p.archived).map((p) => asProject(state, p));
  const tasks = state.tasks.filter(
    (t) => !t.archived && projects.some((p) => p.id === t.projectId),
  );
  const today = date(0),
    nextWeek = date(7);
  const monday = new Date(`${today}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const throughput = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday.getTime() - (7 - i) * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    return {
      week: start.toISOString().slice(0, 10),
      completed: tasks.filter(
        (t) =>
          t.status === 'done' &&
          t.completedAt !== null &&
          t.completedAt >= start.toISOString() &&
          t.completedAt < end.toISOString(),
      ).length,
    };
  });
  const milestones = projects
    .filter((p) => p.status !== 'completed' && p.dueDate && p.dueDate >= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 4);
  return {
    activeProjects: projects.filter((p) => p.status === 'active').length,
    openTasks: tasks.filter((t) => t.status !== 'done').length,
    dueThisWeek: tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && t.dueDate >= today && t.dueDate <= nextWeek,
    ).length,
    atRisk: projects.filter((p) => p.status === 'at_risk').length,
    throughput,
    milestones,
    projects: projects.filter((p) => p.status !== 'completed').slice(0, 6),
    activity: state.activity.slice(0, 8),
  };
}

function execute(path: string, options: RequestOptions): unknown {
  const method = options.method ?? 'GET';
  const url = new URL(path, 'https://demo.rafnexa.example');
  const route = url.pathname;
  if (route === '/demo/reset' && method === 'POST') {
    const state = seed();
    save(state);
    return session(state);
  }
  const state = load();
  if (route === '/auth/session' && method === 'GET') return session(state);
  if (route.startsWith('/auth/'))
    throw new ApiError(
      400,
      'LOCAL_DEMO_ONLY',
      'This portfolio demo works in your browser. Online accounts are available in the server application.',
    );
  if (route === '/dashboard' && method === 'GET') return dashboard(state);
  if (route === '/members' && method === 'GET') return state.members;
  if (route === '/invitations' && method === 'GET') return [];
  if (route === '/projects' && method === 'GET') {
    const query = validate(projectQuerySchema, Object.fromEntries(url.searchParams));
    const matches = state.projects
      .filter((p) => !p.archived)
      .map((p) => asProject(state, p))
      .filter(
        (p) =>
          (!query.status || p.status === query.status) &&
          `${p.name} ${p.clientName ?? ''}`.toLowerCase().includes(query.q.toLowerCase()),
      );
    return {
      items: matches.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: matches.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  if (route === '/projects' && method === 'POST') {
    const input = validate(projectInputSchema, options.body);
    checkClient(state, input.clientId);
    const record: StoredProject = {
      ...input,
      id: crypto.randomUUID(),
      ownerId: state.userId,
      createdAt: new Date().toISOString(),
      archived: false,
    };
    state.projects.unshift(record);
    log(state, `Created ${record.name}`);
    return asProject(state, record);
  }
  const projectRoute = route.match(/^\/projects\/([^/]+)(\/tasks)?$/);
  if (projectRoute) {
    const record = project(state, projectRoute[1]!);
    if (method === 'GET')
      return projectRoute[2]
        ? state.tasks
            .filter((t) => t.projectId === record.id && !t.archived)
            .map((t) => asTask(state, t))
        : asProject(state, record);
    if (!projectRoute[2] && method === 'PUT') {
      const input = validate(projectInputSchema, options.body);
      checkClient(state, input.clientId);
      Object.assign(record, input);
      log(state, `Updated ${record.name}`);
      return asProject(state, record);
    }
    if (!projectRoute[2] && method === 'DELETE') {
      record.archived = true;
      log(state, `Archived ${record.name}`);
      return;
    }
  }
  if (route === '/tasks' && method === 'POST') {
    const input = validate(taskInputSchema, options.body);
    project(state, input.projectId);
    checkAssignee(state, input.assigneeId);
    const now = new Date().toISOString();
    const record: StoredTask = {
      ...input,
      id: crypto.randomUUID(),
      version: 1,
      updatedAt: now,
      completedAt: input.status === 'done' ? now : null,
      archived: false,
    };
    state.tasks.push(record);
    log(state, `Created task: ${record.title}`);
    return asTask(state, record);
  }
  const taskRoute = route.match(/^\/tasks\/([^/]+)$/);
  if (taskRoute && (method === 'PATCH' || method === 'DELETE')) {
    const record = state.tasks.find((t) => t.id === taskRoute[1] && !t.archived);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'This task is no longer available.');
    project(state, record.projectId);
    const input =
      method === 'PATCH'
        ? validate(taskUpdateSchema, options.body)
        : validate(z.object({ version: z.number().int().positive() }).strict(), options.body);
    if (record.version !== input.version)
      throw new ApiError(
        409,
        'VERSION_CONFLICT',
        'This task changed in another session. The board has been refreshed. Please try again.',
      );
    if (method === 'DELETE') {
      record.archived = true;
      log(state, `Archived task: ${record.title}`);
      return;
    }
    const update = validate(taskUpdateSchema, options.body);
    if (update.assigneeId !== undefined) checkAssignee(state, update.assigneeId);
    const now = new Date().toISOString();
    if (update.status !== undefined && update.status !== record.status)
      record.completedAt = update.status === 'done' ? now : null;
    Object.assign(record, update, { version: record.version + 1, updatedAt: now });
    log(state, `Updated task: ${record.title}`);
    return asTask(state, record);
  }
  if (route === '/clients' && method === 'GET')
    return state.clients
      .filter((c) => !c.archived)
      .map((c) => ({
        id: c.id,
        name: c.name,
        contactEmail: c.contactEmail,
        description: c.description,
        createdAt: c.createdAt,
      }));
  if (route === '/clients' && method === 'POST') {
    const input = validate(clientInputSchema, options.body);
    const record = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      archived: false,
    };
    state.clients.unshift(record);
    log(state, `Added client: ${record.name}`);
    return record;
  }
  const clientRoute = route.match(/^\/clients\/([^/]+)$/);
  if (clientRoute && (method === 'PUT' || method === 'DELETE')) {
    const record = state.clients.find((c) => c.id === clientRoute[1] && !c.archived);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'This client is no longer available.');
    if (method === 'PUT') {
      Object.assign(record, validate(clientInputSchema, options.body));
      log(state, `Updated client: ${record.name}`);
      return record;
    }
    if (state.projects.some((p) => !p.archived && p.clientId === record.id))
      throw new ApiError(
        409,
        'CLIENT_IN_USE',
        'Reassign or archive this client’s projects before archiving the client.',
      );
    record.archived = true;
    log(state, `Archived client: ${record.name}`);
    return;
  }
  const memberRoute = route.match(/^\/members\/([^/]+)$/);
  if (memberRoute && method === 'PATCH') {
    const record = state.members.find((m) => m.id === memberRoute[1]);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'This member is unavailable.');
    if (record.id === state.userId || record.role === 'owner')
      throw new ApiError(403, 'FORBIDDEN', 'The demo owner role cannot be changed.');
    const input = validate(memberUpdateSchema, options.body);
    if (input.role === 'viewer') {
      const now = new Date().toISOString();
      for (const task of state.tasks) {
        if (!task.archived && task.assigneeId === record.id) {
          task.assigneeId = null;
          task.version++;
          task.updatedAt = now;
        }
      }
    }
    record.role = input.role;
    log(state, `Updated ${record.name}’s role`);
    return record;
  }
  throw new ApiError(404, 'NOT_FOUND', 'This action is not available in the browser demo.');
}

export async function requestLocalDemo<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const run = () => {
    options.signal?.throwIfAborted();
    return execute(path, options) as T;
  };
  // Serialize read-modify-write transactions between tabs when Web Locks is available.
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(demoStorageKey, run);
  return run();
}
