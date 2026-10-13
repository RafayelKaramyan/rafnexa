import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type {
  RegisterInput,
  LoginInput,
  Session,
  InvitationInput,
  InvitationDetails,
  Invitation,
} from '@rafnexa/shared';
import { roleSchema } from '@rafnexa/shared';
import { rows, write, transaction } from './db.js';
import { hashPassword, verifyPassword, randomToken, tokenHash } from './security.js';
import { HttpError, forbidden, notFound } from './errors.js';
import * as map from './mapping.js';
import { recordActivity, requireManager } from './workspace-store.js';
import { seedDemo } from './seed-demo.js';

export class AuthStore {
  constructor(private readonly pool: Pool) {}

  async session(token: string | undefined): Promise<Session | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const result = await rows(
      this.pool,
      `SELECT s.csrf_token,s.workspace_id,u.id,u.name,u.email FROM sessions s
      JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=s.workspace_id
      JOIN memberships m ON m.user_id=s.user_id AND m.workspace_id=s.workspace_id
      WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(3))`,
      [tokenHash(token)],
    );
    if (!result[0]) return null;
    const user = map.user(result[0]);
    const workspaces = (
      await rows(
        this.pool,
        `SELECT w.id,w.name,w.is_demo,m.role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(3)) ORDER BY w.created_at`,
        [user.id],
      )
    ).map(map.workspace);
    const workspace = workspaces.find((item) => item.id === result[0]?.workspace_id);
    if (!workspace) return null;
    return { user, workspace, workspaces, csrfToken: map.text(result[0], 'csrf_token') };
  }
  private async createSession(userId: string, workspaceId: string) {
    const token = randomToken();
    await write(
      this.pool,
      'INSERT INTO sessions (token_hash,csrf_token,user_id,workspace_id,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY))',
      [tokenHash(token), randomToken(), userId, workspaceId],
    );
    const session = await this.session(token);
    if (!session) throw new Error('Unable to establish a session.');
    return { token, session };
  }
  async register(input: RegisterInput) {
    const passwordHash = await hashPassword(input.password);
    const userId = randomUUID();
    const workspaceId = await transaction(this.pool, async (db) => {
      const duplicate = await rows(db, 'SELECT id FROM users WHERE email=?', [input.email]);
      if (duplicate.length)
        throw new HttpError(
          409,
          'REGISTRATION_UNAVAILABLE',
          'Unable to create this account. Try signing in instead.',
        );
      await write(db, 'INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)', [
        userId,
        input.name,
        input.email,
        passwordHash,
      ]);
      if (input.invitationToken) {
        return this.claimInvitation(db, userId, input.email, input.invitationToken);
      }
      const id = randomUUID();
      if (!input.workspaceName)
        throw new HttpError(422, 'WORKSPACE_REQUIRED', 'Provide a workspace name.');
      await write(db, 'INSERT INTO workspaces (id,name,owner_id) VALUES (?,?,?)', [
        id,
        input.workspaceName,
        userId,
      ]);
      await write(db, "INSERT INTO memberships (workspace_id,user_id,role) VALUES (?,?,'owner')", [
        id,
        userId,
      ]);
      return id;
    });
    return this.createSession(userId, workspaceId);
  }
  async login(input: LoginInput) {
    const found = await rows(this.pool, 'SELECT id,password_hash FROM users WHERE email=?', [
      input.email,
    ]);
    const hash = found[0] ? map.optionalText(found[0], 'password_hash') : null;
    if (!(await verifyPassword(input.password, hash)) || !found[0])
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const userId = map.text(found[0], 'id');
    const workspace = await rows(
      this.pool,
      `SELECT m.workspace_id FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(3)) ORDER BY w.created_at LIMIT 1`,
      [userId],
    );
    if (!workspace[0])
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    return this.createSession(userId, map.text(workspace[0], 'workspace_id'));
  }
  async logout(token: string) {
    await write(this.pool, 'DELETE FROM sessions WHERE token_hash=?', [tokenHash(token)]);
  }
  async switchWorkspace(token: string, session: Session, workspaceId: string) {
    if (!session.workspaces.some((workspace) => workspace.id === workspaceId)) notFound();
    await write(
      this.pool,
      'UPDATE sessions SET workspace_id=?,csrf_token=? WHERE token_hash=? AND user_id=?',
      [workspaceId, randomToken(), tokenHash(token), session.user.id],
    );
    const next = await this.session(token);
    if (!next)
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
    return next;
  }
  async invitation(token: string): Promise<InvitationDetails> {
    const found = await rows(
      this.pool,
      `SELECT i.email,i.role,w.name FROM invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=? AND i.accepted=0 AND i.expires_at>UTC_TIMESTAMP(3) AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(3))`,
      [tokenHash(token)],
    );
    if (!found[0])
      throw new HttpError(
        404,
        'INVITATION_UNAVAILABLE',
        'This invitation has expired or has already been used.',
      );
    const role = roleSchema.exclude(['owner']).parse(found[0].role);
    return { workspaceName: map.text(found[0], 'name'), email: map.text(found[0], 'email'), role };
  }
  private async claimInvitation(db: PoolConnection, userId: string, email: string, token: string) {
    const found = await rows(
      db,
      `SELECT i.* FROM invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=? AND i.accepted=0 AND i.expires_at>UTC_TIMESTAMP(3) AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(3)) FOR UPDATE`,
      [tokenHash(token)],
    );
    if (!found[0])
      throw new HttpError(
        404,
        'INVITATION_UNAVAILABLE',
        'This invitation has expired or has already been used.',
      );
    if (map.text(found[0], 'email') !== email)
      throw new HttpError(
        403,
        'INVITATION_EMAIL',
        'Sign in with the email address this invitation was issued for.',
      );
    const workspaceId = map.text(found[0], 'workspace_id');
    const existing = await rows(
      db,
      'SELECT user_id FROM memberships WHERE user_id=? AND workspace_id=?',
      [userId, workspaceId],
    );
    if (existing.length)
      throw new HttpError(409, 'ALREADY_MEMBER', 'You already belong to this workspace.');
    const count = await rows(db, 'SELECT COUNT(*) count FROM memberships WHERE workspace_id=?', [
      workspaceId,
    ]);
    if (map.number(count[0]!, 'count') >= 100)
      throw new HttpError(422, 'LIMIT_REACHED', 'A workspace supports up to 100 members.');
    await write(db, 'INSERT INTO memberships (workspace_id,user_id,role) VALUES (?,?,?)', [
      workspaceId,
      userId,
      map.text(found[0], 'role'),
    ]);
    await write(db, 'UPDATE invitations SET accepted=1 WHERE id=?', [map.text(found[0], 'id')]);
    return workspaceId;
  }
  async acceptInvitation(token: string, session: Session, sessionToken: string) {
    const workspaceId = await transaction(this.pool, (db) =>
      this.claimInvitation(db, session.user.id, session.user.email, token),
    );
    await write(this.pool, 'UPDATE sessions SET workspace_id=?,csrf_token=? WHERE token_hash=?', [
      workspaceId,
      randomToken(),
      tokenHash(sessionToken),
    ]);
    const next = await this.session(sessionToken);
    if (!next)
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
    return next;
  }
  async invitations(session: Session): Promise<Invitation[]> {
    requireManager(session);
    return (
      await rows(
        this.pool,
        'SELECT id,email,role,expires_at FROM invitations WHERE workspace_id=? AND accepted=0 AND expires_at>UTC_TIMESTAMP(3) ORDER BY created_at DESC LIMIT 100',
        [session.workspace.id],
      )
    ).map((row) => ({
      id: map.text(row, 'id'),
      email: map.text(row, 'email'),
      role: roleSchema.exclude(['owner']).parse(row.role),
      expiresAt: map.timestamp(row, 'expires_at'),
    }));
  }
  async invite(session: Session, input: InvitationInput) {
    requireManager(session);
    if (session.workspace.role === 'admin' && input.role === 'admin') forbidden();
    if (session.workspace.isDemo)
      throw new HttpError(
        422,
        'DEMO_INVITATION',
        'Create your own workspace to invite real team members.',
      );
    const token = randomToken();
    const id = randomUUID();
    await transaction(this.pool, async (db) => {
      const existing = await rows(
        db,
        'SELECT u.id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND u.email=?',
        [session.workspace.id, input.email],
      );
      if (existing.length)
        throw new HttpError(409, 'ALREADY_MEMBER', 'This person already belongs to the workspace.');
      const count = await rows(
        db,
        'SELECT COUNT(*) count FROM invitations WHERE workspace_id=? AND accepted=0 AND expires_at>UTC_TIMESTAMP(3)',
        [session.workspace.id],
      );
      if (map.number(count[0]!, 'count') >= 100)
        throw new HttpError(
          422,
          'LIMIT_REACHED',
          'A workspace supports up to 100 pending invitations.',
        );
      // Reissuing an invitation revokes older links for the same address.
      await write(db, 'DELETE FROM invitations WHERE workspace_id=? AND email=?', [
        session.workspace.id,
        input.email,
      ]);
      await write(
        db,
        'INSERT INTO invitations (id,workspace_id,email,role,token_hash,expires_at) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY))',
        [id, session.workspace.id, input.email, input.role, tokenHash(token)],
      );
      await recordActivity(db, session, `Invited a ${input.role} to the workspace`);
    });
    return { token, invitation: (await this.invitations(session)).find((item) => item.id === id)! };
  }
  async revokeInvitation(session: Session, id: string) {
    requireManager(session);
    const result = await write(
      this.pool,
      'DELETE FROM invitations WHERE id=? AND workspace_id=? AND accepted=0',
      [id, session.workspace.id],
    );
    if (!result.affectedRows) notFound();
  }
  async demo() {
    await this.cleanup();
    const count = await rows(this.pool, 'SELECT COUNT(*) count FROM workspaces WHERE is_demo=1');
    if (map.number(count[0]!, 'count') >= 200)
      throw new HttpError(503, 'DEMO_CAPACITY', 'The demo is busy. Please try again later.');
    const ids = await transaction(this.pool, (db) => seedDemo(db));
    return this.createSession(ids.userId, ids.workspaceId);
  }
  async cleanup() {
    await write(this.pool, 'DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)');
    // Workspace cascades remove only the expired demo's data; orphan demo users follow.
    await transaction(this.pool, async (db) => {
      const expired = await rows(
        db,
        'SELECT id FROM workspaces WHERE is_demo=1 AND expires_at<UTC_TIMESTAMP(3) ORDER BY id FOR UPDATE',
      );
      for (const workspace of expired) {
        const id = map.text(workspace, 'id');
        await write(db, 'DELETE FROM tasks WHERE workspace_id=?', [id]);
        await write(db, 'DELETE FROM projects WHERE workspace_id=?', [id]);
        await write(db, 'DELETE FROM workspaces WHERE id=? AND is_demo=1', [id]);
      }
    });
    await write(
      this.pool,
      `DELETE u FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE m.user_id IS NULL AND u.password_hash IS NULL AND u.email LIKE '%@demo.rafnexa.example'`,
    );
    await write(
      this.pool,
      'DELETE FROM invitations WHERE expires_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)',
    );
  }
}
