# Rafnexa

A project operations workspace by **Rafayel Karamyan**. Projects, clients, tasks
and team ownership in a quiet, focused interface.

**[Open the live demo →](https://rafayelkaramyan.github.io/rafnexa/)**

Explore the dashboard, create a project and move tasks. No registration is
required; your changes are saved in your browser.

## Release status

An independent portfolio project by **Rafayel Karamyan**, created to demonstrate
interface design and frontend/full-stack engineering. The public presentation
uses GitHub Pages and opens directly into an editable workspace.

Published on GitHub Pages and verified on 15 October 2026.
[Passing CI](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38776194748)
includes 23 unit/component tests, 17 MySQL integration tests, 18 server browser
scenarios and 12 Pages browser scenarios. See the [validation record](docs/validation.md).

## Two ways to explore

| Mode               | Behavior                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portfolio demo     | No account or backend setup. Projects, clients, task edits, progress and activity persist in the current browser. Sample teammates are fictional. Reset restores the original data after confirmation. |
| Server application | The same interface backed by Node.js, Express and MySQL, with real account authentication, sessions, workspace isolation and server-enforced roles. Run locally using the instructions below.          |

The public demo does not collect passwords, simulate online registration or send
invitations. Browser data is separate for each visitor and does not synchronize
between devices. Its role controls demonstrate interface behavior, not a security
boundary. See the server application for the authorization implementation.

## Portfolio demo

The Pages build uses hash routing so project and board links survive reloads
without server rewrites. A versioned, validated storage adapter reuses the shared
contracts, computes dashboard metrics from saved records, and rejects stale task
updates. Web Locks serialize updates between tabs when supported; storage events
refresh other tabs. Unreadable data is retained until an explicit reset, and
failed storage writes surface errors instead of claiming success.

```bash
npm ci
npm run build:pages
npx vite preview --config apps/web/vite.config.ts --mode pages
```

Open the preview's `/rafnexa/` path. No MySQL service is needed for this mode.
The GitHub Pages workflow publishes only after the complete CI workflow succeeds.

## Server application features

- Account registration and sign-in with database-backed sessions.
- An isolated, editable demo workspace with fictional data and a 24-hour lifetime.
- Project creation, editing, search, status filtering, pagination and archiving.
- Client management with protection against archiving clients still in use.
- A task board with drag-and-drop and keyboard/touch-friendly status controls.
- Versioned task updates: stale edits return conflicts and refresh the board.
- Owner, admin, member and viewer roles enforced by the API.
- Email-bound invitations with expiry, revocation and replay protection.
- Workspace switching that resets cached data and rotates CSRF context.
- SQL-backed metrics, weekly task completion, milestones and activity.
- Responsive navigation, native dialogs, labeled forms and reduced motion.

Invitation links are copied and shared manually; the application does not send
email. Demo people and organizations are fictional. Personal workspaces start empty.

## Stack and structure

React, strict TypeScript, Vite, React Router and TanStack Query on the client.
Express 5, Node.js and MySQL on the server. Zod contracts are shared between
packages. One Node service serves the production frontend and API from the same origin.

```text
apps/web              React routes, forms, queries and interface
apps/api              HTTP handlers, authorization and SQL transactions
apps/api/migrations   Versioned database schema
packages/shared       Contracts, domain types and permission helpers
tests                 Browser checks against the built app and real API
docs                  Architecture, API, deployment and validation
```

See [architecture](docs/architecture.md), [API](docs/api.md),
[deployment](docs/deployment.md) and [validation](docs/validation.md).

## Run locally

Use Node.js 24 and MySQL 8.4. Docker Compose can start the development database:

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to port 3001. Example database
credentials are exclusively for disposable local development.

For the built app, set `PUBLIC_ORIGIN=http://localhost:3001` locally, then:

```bash
npm run build
npm start
```

## Validate

```bash
npm run check
```

This builds all packages, type-checks tests, checks lint and formatting, and runs
unit/component tests. Integration tests require a migrated database ending in `_test`:

```bash
DATABASE_URL=mysql://user:password@127.0.0.1:3306/rafnexa_test npm run db:migrate
DATABASE_URL=mysql://user:password@127.0.0.1:3306/rafnexa_test npm run test:integration
npx playwright install --with-deps chromium firefox
DATABASE_URL=mysql://user:password@127.0.0.1:3306/rafnexa_test npm run test:e2e
```

Integration tests clear data in the dedicated test database. Never use a database
containing real data. Browser tests use the built Node service, real cookies and
SQL persistence. CI provisions MySQL 8.4 as a service.

## Server security and operational scope

Passwords use salted scrypt. Session/invitation tokens are stored as SHA-256 hashes.
Cookies are HttpOnly, SameSite=Lax and Secure in production. Mutations require the
configured origin; authenticated writes also require a CSRF token. Workspace scope
comes from the server session. User text stays in SQL parameters; only validated,
bounded pagination integers are interpolated.

Remote databases require verified TLS. API errors return a correlation ID without
SQL or credentials. Rate limits run in memory on one service instance, with two
concurrent password operations at most.

This is a portfolio application. Password reset, email verification, billing,
file uploads, realtime push and disaster recovery automation are outside the
implemented scope. Archived data is retained, but an archive restoration UI is
not implemented. Free hosting may sleep. No load-test, throughput or Core Web
Vitals benchmarks are claimed.

## Design

The interface has an original identity, compact navigation, quiet neutral surfaces
and restrained blue accents. No third-party site template or stock imagery is used.
Icons are from Lucide, distributed under its ISC license.
