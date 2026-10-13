import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection } from 'mysql2/promise';
import {
  canManage,
  canEditTask,
  type ClientInput,
  type ProjectInput,
  type TaskInput,
  type TaskUpdate,
  type ProjectQuery,
  type Session,
  type Dashboard,
} from '@rafnexa/shared';
import { rows, write, transaction, type Database, type SqlValue } from './db.js';
import * as map from './mapping.js';
import { HttpError, forbidden, notFound } from './errors.js';

const projectSelect = `SELECT p.*, c.name client_name, u.name owner_name,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.workspace_id=p.workspace_id AND t.archived=0) task_count,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.workspace_id=p.workspace_id AND t.archived=0 AND t.status='done') completed_tasks
  FROM projects p LEFT JOIN clients c ON c.id=p.client_id AND c.workspace_id=p.workspace_id
  JOIN users u ON u.id=p.owner_id`;
const taskSelect = `SELECT t.*, u.name assignee_name FROM tasks t
  LEFT JOIN users u ON u.id=t.assignee_id JOIN projects p ON p.id=t.project_id AND p.workspace_id=t.workspace_id`;
export function requireManager(session: Session): void {
  if (!canManage(session.workspace.role)) forbidden();
}

export async function recordActivity(
  db: Database,
  session: Session,
  message: string,
): Promise<void> {
  await write(db, 'INSERT INTO activity (id,workspace_id,actor_name,message) VALUES (?,?,?,?)', [
    randomUUID(),
    session.workspace.id,
    session.user.name,
    message.slice(0, 250),
  ]);
}

export class WorkspaceStore {
  constructor(private readonly pool: Pool) {}

  async clients(session: Session) {
    return (
      await rows(
        this.pool,
        'SELECT * FROM clients WHERE workspace_id=? AND archived=0 ORDER BY name LIMIT 200',
        [session.workspace.id],
      )
    ).map(map.client);
  }
  async createClient(session: Session, input: ClientInput) {
    requireManager(session);
    const id = randomUUID();
    await transaction(this.pool, async (db) => {
      const count = await rows(
        db,
        'SELECT COUNT(*) count FROM clients WHERE workspace_id=? AND archived=0',
        [session.workspace.id],
      );
      if (map.number(count[0]!, 'count') >= 200)
        throw new HttpError(422, 'LIMIT_REACHED', 'A workspace supports up to 200 clients.');
      await write(
        db,
        'INSERT INTO clients (id,workspace_id,name,contact_email,description) VALUES (?,?,?,?,?)',
        [id, session.workspace.id, input.name, input.contactEmail, input.description],
      );
      await recordActivity(db, session, `Added client ${input.name}`);
    });
    return (await this.clients(session)).find((client) => client.id === id)!;
  }
  async updateClient(session: Session, id: string, input: ClientInput) {
    requireManager(session);
    await transaction(this.pool, async (db) => {
      const result = await write(
        db,
        'UPDATE clients SET name=?,contact_email=?,description=? WHERE id=? AND workspace_id=? AND archived=0',
        [input.name, input.contactEmail, input.description, id, session.workspace.id],
      );
      if (!result.affectedRows) notFound();
      await recordActivity(db, session, `Updated client ${input.name}`);
    });
    return (await this.clients(session)).find((client) => client.id === id)!;
  }
  async archiveClient(session: Session, id: string) {
    requireManager(session);
    await transaction(this.pool, async (db) => {
      const client = await rows(
        db,
        'SELECT name FROM clients WHERE id=? AND workspace_id=? AND archived=0 FOR UPDATE',
        [id, session.workspace.id],
      );
      if (!client[0]) notFound();
      const linked = await rows(
        db,
        'SELECT id FROM projects WHERE client_id=? AND workspace_id=? AND archived=0 LIMIT 1',
        [id, session.workspace.id],
      );
      if (linked.length)
        throw new HttpError(
          409,
          'CLIENT_IN_USE',
          'Archive or reassign this client’s projects first.',
        );
      await write(db, 'UPDATE clients SET archived=1 WHERE id=? AND workspace_id=?', [
        id,
        session.workspace.id,
      ]);
      await recordActivity(db, session, `Archived client ${map.text(client[0], 'name')}`);
    });
  }
  async projects(session: Session, query: ProjectQuery) {
    const clauses = ['p.workspace_id=?', 'p.archived=0'];
    const params: SqlValue[] = [session.workspace.id];
    if (query.q) {
      clauses.push("(p.name LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!')");
      const search = `%${query.q.replace(/[!%_]/g, '!$&')}%`;
      params.push(search, search);
    }
    if (query.status) {
      clauses.push('p.status=?');
      params.push(query.status);
    }
    const where = clauses.join(' AND ');
    const count = await rows(
      this.pool,
      `SELECT COUNT(*) count FROM projects p LEFT JOIN clients c ON c.id=p.client_id AND c.workspace_id=p.workspace_id WHERE ${where}`,
      params,
    );
    // Only validated, bounded integers are interpolated; all user text stays parameterized.
    const items = await rows(
      this.pool,
      `${projectSelect} WHERE ${where} ORDER BY p.created_at DESC,p.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      params,
    );
    return {
      items: items.map(map.project),
      total: map.number(count[0]!, 'count'),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async project(session: Session, id: string, db: Database = this.pool) {
    const result = await rows(
      db,
      `${projectSelect} WHERE p.id=? AND p.workspace_id=? AND p.archived=0`,
      [id, session.workspace.id],
    );
    if (!result[0]) notFound();
    return map.project(result[0]);
  }
  private async validateClient(db: Database, session: Session, id: string | null) {
    if (!id) return;
    if (
      !(
        await rows(db, 'SELECT id FROM clients WHERE id=? AND workspace_id=? AND archived=0', [
          id,
          session.workspace.id,
        ])
      ).length
    )
      notFound();
  }
  async createProject(session: Session, input: ProjectInput) {
    requireManager(session);
    const id = randomUUID();
    await transaction(this.pool, async (db) => {
      await this.validateClient(db, session, input.clientId);
      const count = await rows(
        db,
        'SELECT COUNT(*) count FROM projects WHERE workspace_id=? AND archived=0',
        [session.workspace.id],
      );
      if (map.number(count[0]!, 'count') >= 200)
        throw new HttpError(422, 'LIMIT_REACHED', 'A workspace supports up to 200 projects.');
      await write(
        db,
        'INSERT INTO projects (id,workspace_id,name,description,client_id,owner_id,status,due_date) VALUES (?,?,?,?,?,?,?,?)',
        [
          id,
          session.workspace.id,
          input.name,
          input.description,
          input.clientId,
          session.user.id,
          input.status,
          input.dueDate,
        ],
      );
      await recordActivity(db, session, `Created project ${input.name}`);
    });
    return this.project(session, id);
  }
  async updateProject(session: Session, id: string, input: ProjectInput) {
    requireManager(session);
    await transaction(this.pool, async (db) => {
      await this.project(session, id, db);
      await this.validateClient(db, session, input.clientId);
      await write(
        db,
        'UPDATE projects SET name=?,description=?,client_id=?,status=?,due_date=? WHERE id=? AND workspace_id=? AND archived=0',
        [
          input.name,
          input.description,
          input.clientId,
          input.status,
          input.dueDate,
          id,
          session.workspace.id,
        ],
      );
      await recordActivity(db, session, `Updated project ${input.name}`);
    });
    return this.project(session, id);
  }
  async archiveProject(session: Session, id: string) {
    requireManager(session);
    await transaction(this.pool, async (db) => {
      const project = await this.project(session, id, db);
      await write(db, 'UPDATE projects SET archived=1 WHERE id=? AND workspace_id=?', [
        id,
        session.workspace.id,
      ]);
      await recordActivity(db, session, `Archived project ${project.name}`);
    });
  }
  async tasks(session: Session, projectId: string) {
    await this.project(session, projectId);
    return (
      await rows(
        this.pool,
        `${taskSelect} WHERE t.workspace_id=? AND t.project_id=? AND t.archived=0 AND p.archived=0 ORDER BY t.updated_at DESC,t.id LIMIT 300`,
        [session.workspace.id, projectId],
      )
    ).map(map.task);
  }
  async task(session: Session, id: string, db: Database = this.pool, lock = false) {
    const result = await rows(
      db,
      `${taskSelect} WHERE t.id=? AND t.workspace_id=? AND t.archived=0 AND p.archived=0${lock ? ' FOR UPDATE' : ''}`,
      [id, session.workspace.id],
    );
    if (!result[0]) notFound();
    return map.task(result[0]);
  }
  private async validateAssignee(db: PoolConnection, session: Session, id: string | null) {
    if (!id) return;
    const member = await rows(
      db,
      'SELECT role FROM memberships WHERE user_id=? AND workspace_id=?',
      [id, session.workspace.id],
    );
    if (!member[0]) notFound();
    if (member[0].role === 'viewer')
      throw new HttpError(422, 'READ_ONLY_MEMBER', 'Assign tasks to an owner, admin or member.');
  }
  async createTask(session: Session, input: TaskInput) {
    requireManager(session);
    const id = randomUUID();
    await transaction(this.pool, async (db) => {
      await this.project(session, input.projectId, db);
      await this.validateAssignee(db, session, input.assigneeId);
      const count = await rows(
        db,
        'SELECT COUNT(*) count FROM tasks WHERE project_id=? AND workspace_id=? AND archived=0',
        [input.projectId, session.workspace.id],
      );
      if (map.number(count[0]!, 'count') >= 300)
        throw new HttpError(422, 'LIMIT_REACHED', 'A project supports up to 300 tasks.');
      await write(
        db,
        `INSERT INTO tasks (id,workspace_id,project_id,title,assignee_id,status,priority,due_date,completed_at) VALUES (?,?,?,?,?,?,?,?,${input.status === 'done' ? 'UTC_TIMESTAMP(3)' : 'NULL'})`,
        [
          id,
          session.workspace.id,
          input.projectId,
          input.title,
          input.assigneeId,
          input.status,
          input.priority,
          input.dueDate,
        ],
      );
      await recordActivity(db, session, `Created task ${input.title}`);
    });
    return this.task(session, id);
  }
  async updateTask(session: Session, id: string, input: TaskUpdate) {
    await transaction(this.pool, async (db) => {
      const task = await this.task(session, id, db, true);
      if (!canEditTask(session.workspace.role, session.user.id, task.assigneeId)) forbidden();
      if (
        !canManage(session.workspace.role) &&
        input.assigneeId !== undefined &&
        input.assigneeId !== session.user.id
      )
        forbidden();
      if (task.version !== input.version)
        throw new HttpError(
          409,
          'VERSION_CONFLICT',
          'This task changed in another session. Refresh and try again.',
        );
      const next = {
        ...task,
        title: input.title ?? task.title,
        status: input.status ?? task.status,
        priority: input.priority ?? task.priority,
        assigneeId: input.assigneeId === undefined ? task.assigneeId : input.assigneeId,
        dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate,
      };
      await this.validateAssignee(db, session, next.assigneeId);
      const completed =
        next.status === 'done'
          ? task.status === 'done'
            ? 'completed_at'
            : 'UTC_TIMESTAMP(3)'
          : 'NULL';
      const result = await write(
        db,
        `UPDATE tasks SET title=?,assignee_id=?,status=?,priority=?,due_date=?,version=version+1,updated_at=UTC_TIMESTAMP(3),completed_at=${completed} WHERE id=? AND workspace_id=? AND version=? AND archived=0`,
        [
          next.title,
          next.assigneeId,
          next.status,
          next.priority,
          next.dueDate,
          id,
          session.workspace.id,
          input.version,
        ],
      );
      if (!result.affectedRows)
        throw new HttpError(
          409,
          'VERSION_CONFLICT',
          'This task changed in another session. Refresh and try again.',
        );
      await recordActivity(db, session, `Updated task ${next.title}`);
    });
    return this.task(session, id);
  }
  async archiveTask(session: Session, id: string, version: number) {
    requireManager(session);
    await transaction(this.pool, async (db) => {
      const task = await this.task(session, id, db, true);
      if (task.version !== version)
        throw new HttpError(
          409,
          'VERSION_CONFLICT',
          'This task changed in another session. Refresh and try again.',
        );
      await write(
        db,
        'UPDATE tasks SET archived=1,version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND workspace_id=?',
        [id, session.workspace.id],
      );
      await recordActivity(db, session, `Archived task ${task.title}`);
    });
  }
  async members(session: Session) {
    return (
      await rows(
        this.pool,
        "SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY FIELD(m.role,'owner','admin','member','viewer'),u.name LIMIT 100",
        [session.workspace.id],
      )
    ).map(map.member);
  }
  async setMemberRole(session: Session, userId: string, role: 'admin' | 'member' | 'viewer') {
    requireManager(session);
    if (userId === session.user.id)
      throw new HttpError(422, 'OWN_ROLE', 'You cannot change your own role.');
    await transaction(this.pool, async (db) => {
      const existing = await rows(
        db,
        'SELECT role FROM memberships WHERE user_id=? AND workspace_id=? FOR UPDATE',
        [userId, session.workspace.id],
      );
      if (!existing[0]) notFound();
      if (
        existing[0].role === 'owner' ||
        (session.workspace.role === 'admin' && (existing[0].role === 'admin' || role === 'admin'))
      )
        forbidden();
      if (role === 'viewer') {
        await write(
          db,
          'UPDATE tasks SET assignee_id=NULL,version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE assignee_id=? AND workspace_id=? AND archived=0',
          [userId, session.workspace.id],
        );
      }
      await write(db, 'UPDATE memberships SET role=? WHERE user_id=? AND workspace_id=?', [
        role,
        userId,
        session.workspace.id,
      ]);
      await recordActivity(db, session, `Changed a team member’s role to ${role}`);
    });
  }
  async dashboard(session: Session): Promise<Dashboard> {
    const id = session.workspace.id;
    const [projects, counts, weeks, activity] = await Promise.all([
      this.projects(session, { q: '', page: 1, pageSize: 50 }),
      rows(
        this.pool,
        `SELECT COUNT(*) open_tasks,COALESCE(SUM(t.due_date BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(),INTERVAL 7 DAY)),0) due_week FROM tasks t JOIN projects p ON p.id=t.project_id AND p.workspace_id=t.workspace_id WHERE t.workspace_id=? AND t.archived=0 AND p.archived=0 AND t.status<>'done'`,
        [id],
      ),
      rows(
        this.pool,
        `SELECT DATE_FORMAT(DATE_SUB(completed_at,INTERVAL WEEKDAY(completed_at) DAY),'%Y-%m-%d') week,COUNT(*) completed FROM tasks WHERE workspace_id=? AND archived=0 AND status='done' AND completed_at>=DATE_SUB(UTC_DATE(),INTERVAL 7 WEEK) GROUP BY week ORDER BY week`,
        [id],
      ),
      rows(
        this.pool,
        'SELECT * FROM activity WHERE workspace_id=? ORDER BY created_at DESC,id DESC LIMIT 8',
        [id],
      ),
    ]);
    const projectCounts = await rows(
      this.pool,
      `SELECT COALESCE(SUM(status='active'),0) active,COALESCE(SUM(status='at_risk'),0) risk FROM projects WHERE workspace_id=? AND archived=0`,
      [id],
    );
    const milestones = await rows(
      this.pool,
      `${projectSelect} WHERE p.workspace_id=? AND p.archived=0 AND p.due_date IS NOT NULL AND p.status<>'completed' ORDER BY p.due_date,p.id LIMIT 4`,
      [id],
    );
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    const throughput = Array.from({ length: 8 }, (_, i) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - (7 - i) * 7);
      const week = date.toISOString().slice(0, 10);
      const row = weeks.find((row) => row.week === week);
      return { week, completed: row ? map.number(row, 'completed') : 0 };
    });
    return {
      activeProjects: map.number(projectCounts[0]!, 'active'),
      atRisk: map.number(projectCounts[0]!, 'risk'),
      openTasks: map.number(counts[0]!, 'open_tasks'),
      dueThisWeek: map.number(counts[0]!, 'due_week'),
      throughput,
      milestones: milestones.map(map.project),
      projects: projects.items.slice(0, 5),
      activity: activity.map((row) => ({
        id: map.text(row, 'id'),
        actorName: map.text(row, 'actor_name'),
        message: map.text(row, 'message'),
        createdAt: map.timestamp(row, 'created_at'),
      })),
    };
  }
}
