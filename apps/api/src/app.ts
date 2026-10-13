import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response, type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Pool } from 'mysql2/promise';
import {
  registerSchema,
  loginSchema,
  clientInputSchema,
  projectInputSchema,
  taskInputSchema,
  taskUpdateSchema,
  projectQuerySchema,
  idSchema,
  invitationInputSchema,
  acceptInvitationSchema,
  memberUpdateSchema,
  switchWorkspaceSchema,
  type Session,
} from '@rafnexa/shared';
import type { Config } from './config.js';
import { AuthStore } from './auth-store.js';
import { WorkspaceStore } from './workspace-store.js';
import { HttpError } from './errors.js';
import { constantEqual } from './security.js';
import { rows } from './db.js';

const cookieName = 'rafnexa_session';
const unsafeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
type ApiRoute = (req: Request, session: Session, token: string, res: Response) => Promise<unknown>;
type AppOptions = { rateLimiting?: boolean; serveWeb?: boolean };
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
function cookieToken(req: Request): string | undefined {
  const match = req.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`));
  return match?.slice(cookieName.length + 1);
}
export function createApp(pool: Pool, config: Config, options: AppOptions = {}) {
  const app = express();
  const auth = new AuthStore(pool);
  const store = new WorkspaceStore(pool);
  app.disable('x-powered-by');
  app.set('trust proxy', config.production ? 1 : false);
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      ...(!config.production ? { hsts: false } : {}),
    }),
  );
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (unsafeMethods.has(req.method)) {
      if (req.headers.origin !== config.origin)
        return next(
          new HttpError(403, 'ORIGIN_REJECTED', 'This request must come from the application.'),
        );
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json'))
        return next(new HttpError(415, 'JSON_REQUIRED', 'Send requests as JSON.'));
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  if (options.rateLimiting !== false) {
    const limiter = (limit: number, windowMs: number) =>
      rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) =>
          res.status(429).json({
            error: {
              code: 'RATE_LIMIT',
              message: 'Too many requests. Please try again later.',
              requestId: res.locals.requestId,
            },
          }),
      });
    app.use('/api', limiter(600, 15 * 60 * 1000));
    app.use(['/api/auth/login', '/api/auth/register'], limiter(15, 15 * 60 * 1000));
    app.use('/api/auth/demo', limiter(6, 60 * 60 * 1000));
    const mutationLimiter = limiter(120, 15 * 60 * 1000);
    app.use('/api', (req, res, next) =>
      unsafeMethods.has(req.method) ? mutationLimiter(req, res, next) : next(),
    );
  }
  const setSessionCookie = (res: Response, token: string) =>
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  const route =
    (handler: ApiRoute, status = 200) =>
    async (req: Request, res: Response) => {
      const token = cookieToken(req);
      const session = await auth.session(token);
      if (!token || !session)
        throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
      if (
        unsafeMethods.has(req.method) &&
        !constantEqual(req.get('X-CSRF-Token') ?? '', session.csrfToken)
      )
        throw new HttpError(
          403,
          'CSRF_REJECTED',
          'Your session changed. Refresh the page and try again.',
        );
      const result = await handler(req, session, token, res);
      if (status === 204) res.sendStatus(204);
      else res.status(status).json(result);
    };
  let passwordRequests = 0;
  const authenticate =
    (handler: (req: Request) => ReturnType<AuthStore['login']>) =>
    async (req: Request, res: Response) => {
      if (passwordRequests >= 2)
        throw new HttpError(503, 'AUTH_BUSY', 'Sign in is busy. Please try again shortly.');
      passwordRequests++;
      try {
        const result = await handler(req);
        const previous = cookieToken(req);
        if (previous) await auth.logout(previous);
        setSessionCookie(res, result.token);
        res.json(result.session);
      } finally {
        passwordRequests--;
      }
    };
  app.get('/api/health', async (_req, res) => {
    await rows(pool, 'SELECT 1');
    res.json({ status: 'ok' });
  });
  app.get('/api/auth/session', async (req, res) => {
    const session = await auth.session(cookieToken(req));
    if (!session) throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in to continue.');
    res.json(session);
  });
  app.post(
    '/api/auth/register',
    authenticate((req) => auth.register(parse(registerSchema, req.body))),
  );
  app.post(
    '/api/auth/login',
    authenticate((req) => auth.login(parse(loginSchema, req.body))),
  );
  app.post('/api/auth/demo', async (req, res) => {
    const result = await auth.demo();
    const previous = cookieToken(req);
    if (previous) await auth.logout(previous);
    setSessionCookie(res, result.token);
    res.status(201).json(result.session);
  });
  app.post(
    '/api/auth/logout',
    route(async (_req, _session, token, res) => {
      await auth.logout(token);
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        path: '/',
      });
      return null;
    }, 204),
  );
  app.post(
    '/api/auth/switch',
    route((req, session, token) =>
      auth.switchWorkspace(token, session, parse(switchWorkspaceSchema, req.body).workspaceId),
    ),
  );
  app.post('/api/auth/invitation', async (req, res) =>
    res.json(await auth.invitation(parse(acceptInvitationSchema, req.body).token)),
  );
  app.post(
    '/api/auth/accept-invitation',
    route((req, session, token) =>
      auth.acceptInvitation(parse(acceptInvitationSchema, req.body).token, session, token),
    ),
  );
  app.get(
    '/api/dashboard',
    route((_req, session) => store.dashboard(session)),
  );
  app.get(
    '/api/projects',
    route((req, session) => store.projects(session, parse(projectQuerySchema, req.query))),
  );
  app.get(
    '/api/projects/:id',
    route((req, session) => store.project(session, parse(idSchema, req.params.id))),
  );
  app.post(
    '/api/projects',
    route((req, session) => store.createProject(session, parse(projectInputSchema, req.body)), 201),
  );
  app.put(
    '/api/projects/:id',
    route((req, session) =>
      store.updateProject(
        session,
        parse(idSchema, req.params.id),
        parse(projectInputSchema, req.body),
      ),
    ),
  );
  app.delete(
    '/api/projects/:id',
    route((req, session) => store.archiveProject(session, parse(idSchema, req.params.id)), 204),
  );
  app.get(
    '/api/projects/:id/tasks',
    route((req, session) => store.tasks(session, parse(idSchema, req.params.id))),
  );
  app.post(
    '/api/tasks',
    route((req, session) => store.createTask(session, parse(taskInputSchema, req.body)), 201),
  );
  app.patch(
    '/api/tasks/:id',
    route((req, session) =>
      store.updateTask(session, parse(idSchema, req.params.id), parse(taskUpdateSchema, req.body)),
    ),
  );
  app.delete(
    '/api/tasks/:id',
    route(
      (req, session) =>
        store.archiveTask(
          session,
          parse(idSchema, req.params.id),
          parse(z.object({ version: z.number().int().positive() }).strict(), req.body).version,
        ),
      204,
    ),
  );
  app.get(
    '/api/clients',
    route((_req, session) => store.clients(session)),
  );
  app.post(
    '/api/clients',
    route((req, session) => store.createClient(session, parse(clientInputSchema, req.body)), 201),
  );
  app.put(
    '/api/clients/:id',
    route((req, session) =>
      store.updateClient(
        session,
        parse(idSchema, req.params.id),
        parse(clientInputSchema, req.body),
      ),
    ),
  );
  app.delete(
    '/api/clients/:id',
    route((req, session) => store.archiveClient(session, parse(idSchema, req.params.id)), 204),
  );
  app.get(
    '/api/members',
    route((_req, session) => store.members(session)),
  );
  app.patch(
    '/api/members/:id',
    route(
      (req, session) =>
        store.setMemberRole(
          session,
          parse(idSchema, req.params.id),
          parse(memberUpdateSchema, req.body).role,
        ),
      204,
    ),
  );
  app.get(
    '/api/invitations',
    route((_req, session) => auth.invitations(session)),
  );
  app.post(
    '/api/invitations',
    route((req, session) => auth.invite(session, parse(invitationInputSchema, req.body)), 201),
  );
  app.delete(
    '/api/invitations/:id',
    route((req, session) => auth.revokeInvitation(session, parse(idSchema, req.params.id)), 204),
  );
  app.use('/api', (_req, _res, next) =>
    next(new HttpError(404, 'NOT_FOUND', 'This endpoint is unavailable.')),
  );
  if (options.serveWeb !== false) {
    const webRoot = path.resolve(import.meta.dirname, '../../web/dist');
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webRoot, 'index.html'));
    });
  }
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const requestId = String(res.locals.requestId);
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join('.') || 'form'] = issue.message;
      res.status(422).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Please check the highlighted fields.',
          fields,
          requestId,
        },
      });
      return;
    }
    if (error instanceof HttpError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, requestId } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: {
          code: 'MALFORMED_JSON',
          message: 'The request contains invalid JSON.',
          requestId,
        },
      });
      return;
    }
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large.', requestId },
      });
      return;
    }
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    if (code === 'ER_DUP_ENTRY') {
      res
        .status(409)
        .json({ error: { code: 'CONFLICT', message: 'This record already exists.', requestId } });
      return;
    }
    // Log only a safe correlation ID and an error category, never SQL, credentials or payloads.
    console.error(JSON.stringify({ level: 'error', requestId, code }));
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId,
      },
    });
  };
  app.use(errorHandler);
  return { app, auth };
}
