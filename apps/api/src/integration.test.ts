import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { Session, Project, Task, Client } from '@rafnexa/shared';
import { loadConfig } from './config.js';
import { createPool, write, rows } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
if (!new URL(config.databaseUrl).pathname.endsWith('_test'))
  throw new Error('Integration tests require a dedicated database whose name ends in _test.');
const pool = createPool(config);
const { app, auth } = createApp(pool, config, { rateLimiting: false, serveWeb: false });
const owner = request.agent(app),
  other = request.agent(app),
  member = request.agent(app),
  viewer = request.agent(app);
let ownerSession: Session, otherSession: Session, memberSession: Session, viewerSession: Session;
let project: Project, client: Client, task: Task;
const password = 'a-real-integration-password';
function headers(session: Session) {
  return { Origin: config.origin, 'X-CSRF-Token': session.csrfToken };
}
beforeAll(async () => {
  for (const table of [
    'tasks',
    'projects',
    'clients',
    'sessions',
    'invitations',
    'activity',
    'memberships',
    'workspaces',
    'users',
  ])
    await write(pool, `DELETE FROM ${table}`);
  const first = await owner
    .post('/api/auth/register')
    .set('Origin', config.origin)
    .send({
      name: 'Owner One',
      email: 'owner@example.com',
      password,
      workspaceName: 'First workspace',
    })
    .expect(200);
  ownerSession = first.body as Session;
  const second = await other
    .post('/api/auth/register')
    .set('Origin', config.origin)
    .send({
      name: 'Owner Two',
      email: 'other@example.com',
      password,
      workspaceName: 'Second workspace',
    })
    .expect(200);
  otherSession = second.body as Session;
  for (const [agent, email, name, role] of [
    [member, 'member@example.com', 'Team Member', 'member'],
    [viewer, 'viewer@example.com', 'Team Viewer', 'viewer'],
  ] as const) {
    const invite = await owner
      .post('/api/invitations')
      .set(headers(ownerSession))
      .send({ email, role })
      .expect(201);
    const result = await agent
      .post('/api/auth/register')
      .set('Origin', config.origin)
      .send({ name, email, password, invitationToken: invite.body.token })
      .expect(200);
    if (role === 'member') memberSession = result.body as Session;
    else viewerSession = result.body as Session;
  }
  client = (
    await owner
      .post('/api/clients')
      .set(headers(ownerSession))
      .send({ name: 'Real test client', contactEmail: null, description: '' })
      .expect(201)
  ).body as Client;
  project = (
    await owner
      .post('/api/projects')
      .set(headers(ownerSession))
      .send({
        name: 'Portal delivery',
        description: 'Test delivery',
        clientId: client.id,
        status: 'active',
        dueDate: '2026-12-01',
      })
      .expect(201)
  ).body as Project;
  task = (
    await owner
      .post('/api/tasks')
      .set(headers(ownerSession))
      .send({
        title: 'Implement real persistence',
        projectId: project.id,
        assigneeId: memberSession.user.id,
        status: 'todo',
        priority: 'high',
        dueDate: null,
      })
      .expect(201)
  ).body as Task;
}, 60_000);
afterAll(() => pool.end());
describe('workspace API against a real SQL database', () => {
  it('creates a real owner session and hashes passwords in the database', async () => {
    expect(ownerSession.workspace.role).toBe('owner');
    expect(ownerSession.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const user = (
      await rows(pool, 'SELECT password_hash FROM users WHERE id=?', [ownerSession.user.id])
    )[0];
    expect(user?.password_hash).toMatch(/^scrypt-v1:/);
    expect(user?.password_hash).not.toContain(password);
    const session = (
      await rows(pool, 'SELECT token_hash FROM sessions WHERE user_id=?', [ownerSession.user.id])
    )[0];
    expect(session?.token_hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects missing sessions, foreign origins and missing CSRF tokens', async () => {
    await request(app).get('/api/projects').expect(401);
    await owner.post('/api/projects').set('Origin', 'https://foreign.example').send({}).expect(403);
    await owner.post('/api/projects').set('Origin', config.origin).send({}).expect(403);
  });
  it('never reads or modifies another workspace’s projects', async () => {
    await other.get(`/api/projects/${project.id}`).expect(404);
    await other
      .put(`/api/projects/${project.id}`)
      .set(headers(otherSession))
      .send({ name: 'Hijacked', clientId: null, description: '', status: 'active', dueDate: null })
      .expect(404);
    const list = await other.get('/api/projects').expect(200);
    expect(list.body.items).toEqual([]);
  });
  it('rejects cross-workspace references and tenant spoofing', async () => {
    await other
      .post('/api/projects')
      .set(headers(otherSession))
      .send({ name: 'Bad reference', clientId: client.id, status: 'active', dueDate: null })
      .expect(404);
    await owner
      .post('/api/tasks')
      .set(headers(ownerSession))
      .send({
        title: 'Bad assignment',
        projectId: project.id,
        assigneeId: otherSession.user.id,
        status: 'todo',
        priority: 'low',
        dueDate: null,
      })
      .expect(404);
    await owner
      .post('/api/projects')
      .set(headers(ownerSession))
      .send({
        name: 'Bad tenant',
        clientId: null,
        status: 'active',
        dueDate: null,
        workspaceId: otherSession.workspace.id,
      })
      .expect(422);
  });
  it('keeps viewers read only across projects, clients, tasks and roles', async () => {
    await viewer.get('/api/projects').expect(200);
    await viewer
      .post('/api/projects')
      .set(headers(viewerSession))
      .send({ name: 'Blocked', clientId: null, status: 'active', dueDate: null })
      .expect(403);
    await viewer
      .post('/api/clients')
      .set(headers(viewerSession))
      .send({ name: 'Blocked client', contactEmail: null })
      .expect(403);
    await viewer
      .patch(`/api/tasks/${task.id}`)
      .set(headers(viewerSession))
      .send({ version: task.version, status: 'done' })
      .expect(403);
    await viewer
      .patch(`/api/members/${memberSession.user.id}`)
      .set(headers(viewerSession))
      .send({ role: 'admin' })
      .expect(403);
  });
  it('lets members update assigned tasks while preserving ownership restrictions', async () => {
    const result = await member
      .patch(`/api/tasks/${task.id}`)
      .set(headers(memberSession))
      .send({ version: task.version, status: 'in_progress' })
      .expect(200);
    task = result.body as Task;
    expect(task.version).toBe(2);
    await member
      .patch(`/api/tasks/${task.id}`)
      .set(headers(memberSession))
      .send({ version: task.version, assigneeId: ownerSession.user.id })
      .expect(403);
    await member
      .post('/api/tasks')
      .set(headers(memberSession))
      .send({
        title: 'Not allowed',
        projectId: project.id,
        assigneeId: memberSession.user.id,
        status: 'todo',
        priority: 'low',
        dueDate: null,
      })
      .expect(403);
  });
  it('rejects access to another member’s task', async () => {
    const different = (
      await owner
        .post('/api/tasks')
        .set(headers(ownerSession))
        .send({
          title: 'Owner task',
          projectId: project.id,
          assigneeId: ownerSession.user.id,
          status: 'todo',
          priority: 'medium',
          dueDate: null,
        })
        .expect(201)
    ).body as Task;
    await member
      .patch(`/api/tasks/${different.id}`)
      .set(headers(memberSession))
      .send({ version: different.version, status: 'done' })
      .expect(403);
  });
  it('detects concurrent task edits and keeps the committed change', async () => {
    const results = await Promise.all(
      ['done', 'in_review'].map((status) =>
        owner
          .patch(`/api/tasks/${task.id}`)
          .set(headers(ownerSession))
          .send({ version: task.version, status }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    task = results.find((result) => result.status === 200)!.body as Task;
    const persisted = await owner.get(`/api/projects/${project.id}/tasks`).expect(200);
    expect(persisted.body.find((item: Task) => item.id === task.id).version).toBe(task.version);
  });
  it('treats SQL-looking search input as data and escapes wildcard searches', async () => {
    const result = await owner.get('/api/projects').query({ q: "%' OR 1=1 --" }).expect(200);
    expect(result.body.total).toBe(0);
    const wildcard = await owner.get('/api/projects').query({ q: '%' }).expect(200);
    expect(wildcard.body.total).toBe(0);
    await owner.get('/api/projects').query({ pageSize: 1000 }).expect(422);
  });
  it('binds invitations to email addresses and rejects replay', async () => {
    const invite = await owner
      .post('/api/invitations')
      .set(headers(ownerSession))
      .send({ email: 'new@example.com', role: 'viewer' })
      .expect(201);
    await other
      .post('/api/auth/accept-invitation')
      .set(headers(otherSession))
      .send({ token: invite.body.token })
      .expect(403);
    const joined = request.agent(app);
    await joined
      .post('/api/auth/register')
      .set('Origin', config.origin)
      .send({
        name: 'New User',
        email: 'new@example.com',
        password,
        invitationToken: invite.body.token,
      })
      .expect(200);
    await owner
      .post('/api/auth/invitation')
      .set('Origin', config.origin)
      .send({ token: invite.body.token })
      .expect(404);
  });
  it('keeps admin promotion and owner management exclusive to the owner', async () => {
    await owner
      .patch(`/api/members/${viewerSession.user.id}`)
      .set(headers(ownerSession))
      .send({ role: 'admin' })
      .expect(204);
    const fresh = await viewer.get('/api/auth/session').expect(200);
    viewerSession = fresh.body as Session;
    expect(viewerSession.workspace.role).toBe('admin');
    await viewer
      .post('/api/invitations')
      .set(headers(viewerSession))
      .send({ email: 'admin@example.com', role: 'admin' })
      .expect(403);
    await viewer
      .patch(`/api/members/${ownerSession.user.id}`)
      .set(headers(viewerSession))
      .send({ role: 'viewer' })
      .expect(403);
    await owner
      .patch(`/api/members/${ownerSession.user.id}`)
      .set(headers(ownerSession))
      .send({ role: 'viewer' })
      .expect(422);
  });
  it('unassigns active tasks and increments versions when a member becomes a viewer', async () => {
    await owner
      .patch(`/api/members/${memberSession.user.id}`)
      .set(headers(ownerSession))
      .send({ role: 'viewer' })
      .expect(204);
    const found = await owner.get(`/api/projects/${project.id}/tasks`).expect(200);
    const updated = found.body.find((item: Task) => item.id === task.id) as Task;
    expect(updated.assigneeId).toBeNull();
    expect(updated.version).toBe(task.version + 1);
    await member
      .patch(`/api/tasks/${task.id}`)
      .set(headers(memberSession))
      .send({ version: updated.version, status: 'done' })
      .expect(403);
  });
  it('protects clients linked to projects and hides archived projects and tasks', async () => {
    await owner.delete(`/api/clients/${client.id}`).set(headers(ownerSession)).expect(409);
    await owner.delete(`/api/projects/${project.id}`).set(headers(ownerSession)).expect(204);
    await owner.get(`/api/projects/${project.id}`).expect(404);
    await owner.get(`/api/projects/${project.id}/tasks`).expect(404);
    await owner.delete(`/api/clients/${client.id}`).set(headers(ownerSession)).expect(204);
  });
  it('isolates seeded demos and cleans up expired workspaces without touching real ones', async () => {
    const first = request.agent(app),
      second = request.agent(app);
    const a = (await first.post('/api/auth/demo').set('Origin', config.origin).send({}).expect(201))
      .body as Session;
    const b = (
      await second.post('/api/auth/demo').set('Origin', config.origin).send({}).expect(201)
    ).body as Session;
    expect(a.workspace.id).not.toBe(b.workspace.id);
    const projects = await first.get('/api/projects').expect(200);
    await second.get(`/api/projects/${projects.body.items[0].id}`).expect(404);
    await write(
      pool,
      'UPDATE workspaces SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE id=?',
      [a.workspace.id],
    );
    await auth.cleanup();
    await first.get('/api/auth/session').expect(401);
    await second.get('/api/auth/session').expect(200);
    await owner.get('/api/auth/session').expect(200);
  });
  it('rotates CSRF context on workspace switching and prevents arbitrary switching', async () => {
    await other
      .post('/api/auth/switch')
      .set(headers(otherSession))
      .send({ workspaceId: ownerSession.workspace.id })
      .expect(404);
    const next = await other
      .post('/api/auth/switch')
      .set(headers(otherSession))
      .send({ workspaceId: otherSession.workspace.id })
      .expect(200);
    expect(next.body.csrfToken).not.toBe(otherSession.csrfToken);
    await other
      .post('/api/clients')
      .set(headers(otherSession))
      .send({ name: 'Stale token', contactEmail: null })
      .expect(403);
    otherSession = next.body as Session;
  });
  it('invalidates sessions on logout and uses HttpOnly cookies on login', async () => {
    const fresh = request.agent(app);
    const login = await fresh
      .post('/api/auth/login')
      .set('Origin', config.origin)
      .send({ email: 'other@example.com', password })
      .expect(200);
    const cookies = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? '');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    await fresh
      .post('/api/auth/logout')
      .set(headers(login.body as Session))
      .send({})
      .expect(204);
    await fresh.get('/api/auth/session').expect(401);
    await fresh
      .post('/api/auth/login')
      .set('Origin', config.origin)
      .send({ email: 'other@example.com', password: 'wrong-password' })
      .expect(401);
  });
  it('returns sanitized errors and a request ID for missing records', async () => {
    const response = await owner.get(`/api/projects/${randomUUID()}`).expect(404);
    expect(response.body.error).toEqual(
      expect.objectContaining({ code: 'NOT_FOUND', requestId: expect.any(String) }),
    );
    expect(response.text).not.toMatch(/SELECT|password_hash|stack/);
  });
});
