import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { write } from './db.js';

function date(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export async function seedDemo(db: PoolConnection) {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const people = [
    { id: userId, name: 'Demo visitor', role: 'owner' },
    { id: randomUUID(), name: 'Maya Chen', role: 'admin' },
    { id: randomUUID(), name: 'Daniel Reyes', role: 'member' },
    { id: randomUUID(), name: 'Nina Brooks', role: 'member' },
    { id: randomUUID(), name: 'Alex Morgan', role: 'viewer' },
  ];
  for (const person of people)
    await write(db, 'INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,NULL)', [
      person.id,
      person.name,
      `${person.id}@demo.rafnexa.example`,
    ]);
  await write(
    db,
    'INSERT INTO workspaces (id,name,owner_id,is_demo,expires_at) VALUES (?,?,?,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY))',
    [workspaceId, 'Studio workspace', userId],
  );
  for (const person of people)
    await write(db, 'INSERT INTO memberships (workspace_id,user_id,role) VALUES (?,?,?)', [
      workspaceId,
      person.id,
      person.role,
    ]);
  const clients = ['Studio West', 'Cobalt Works', 'Atlas Collective', 'Oakline'].map((name) => ({
    id: randomUUID(),
    name,
  }));
  for (const client of clients)
    await write(
      db,
      'INSERT INTO clients (id,workspace_id,name,contact_email,description) VALUES (?,?,?,NULL,?)',
      [
        client.id,
        workspaceId,
        client.name,
        'Fictional organization for the isolated demo workspace.',
      ],
    );
  const projects = [
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
  ];
  const statuses = ['done', 'in_progress', 'in_review', 'todo'] as const;
  for (const [index, project] of projects.entries()) {
    const projectId = randomUUID();
    await write(
      db,
      'INSERT INTO projects (id,workspace_id,name,description,client_id,owner_id,status,due_date,created_at) VALUES (?,?,?,?,?,?,?,?,DATE_SUB(UTC_TIMESTAMP(3),INTERVAL ? DAY))',
      [
        projectId,
        workspaceId,
        project.name,
        `A sample delivery project for ${clients[project.client]!.name}.`,
        clients[project.client]!.id,
        people[index % 4]!.id,
        project.status,
        date(project.due),
        index,
      ],
    );
    for (const [taskIndex, title] of project.tasks.entries()) {
      const status = project.status === 'completed' ? 'done' : statuses[taskIndex % 4]!;
      await write(
        db,
        'INSERT INTO tasks (id,workspace_id,project_id,title,assignee_id,status,priority,due_date,completed_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          workspaceId,
          projectId,
          title,
          people[taskIndex % 4]!.id,
          status,
          taskIndex === 3 ? 'high' : taskIndex === 0 ? 'low' : 'medium',
          date(project.due - taskIndex),
          status === 'done' ? `${date(-index * 7 - 1)} 12:00:00` : null,
        ],
      );
    }
  }
  for (const [index, message] of [
    'Moved a task to In review',
    'Created Customer portal',
    'Completed Support workspace',
    'Updated Design system v2',
  ].entries()) {
    await write(
      db,
      'INSERT INTO activity (id,workspace_id,actor_name,message,created_at) VALUES (?,?,?,?,DATE_SUB(UTC_TIMESTAMP(3),INTERVAL ? HOUR))',
      [randomUUID(), workspaceId, people[index % 4]!.name, message, index + 1],
    );
  }
  return { userId, workspaceId };
}
