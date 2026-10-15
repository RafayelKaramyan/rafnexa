# Architecture and decisions

## Portfolio presentation mode

The `pages` Vite build selects the browser storage transport and hash router.
Normal builds retain the HTTP API and browser-history router. Shared Zod contracts
validate both transports; React routes, forms and query invalidation are reused.

`apps/web/src/lib/local-demo.ts` owns a versioned browser document. Each operation
reads the latest snapshot, validates inputs and references, applies changes, then
persists before reporting success. Task versions reject stale writes. Dashboard
progress, throughput and activity are derived from saved records. Web Locks
serialize transactions between supported tabs, and storage events invalidate
queries in other tabs. Visitors on different browsers do not share data.

There are no passwords or online sessions in this mode. The session-shaped context
identifies a fictional demo owner for interface reuse; it is not authentication.
The public UI omits sign-in, registration, sign-out and real invitation controls.
Storage errors are surfaced and unreadable data is preserved for an explicit reset.

The following sections describe the separate Node/MySQL server application.

## One origin and explicit boundaries

Express serves the built React app and `/api`; development uses Vite's proxy.
Same-origin cookies avoid cross-site cookie dependencies and broad CORS rules.
The web package owns presentation and query state, while the API authorizes writes.

Shared Zod contracts define input and domain types. `AuthStore` owns users,
sessions, memberships and invitations. `WorkspaceStore` owns delivery operations
and their activity records. HTTP handlers validate, authenticate and enforce CSRF.
Parameterized SQL stays close to the operations it implements without a generic
repository abstraction or a second production persistence adapter.

## Tenant isolation and roles

A session selects a workspace from verified memberships. Bodies cannot supply a
tenant ID. Queries include the session's workspace ID. Foreign project, client
and assignee references remain unavailable even if their UUIDs are known.
Composite foreign keys reinforce related workspace IDs. Each request checks the
current membership, so role changes affect subsequent requests.

Owners/admins manage delivery. Members update their assigned tasks. Viewers read.
Only owners grant admin roles; admins cannot change owners or other admins.
Making a member a viewer unassigns active tasks and increments their versions.

## Authentication

Random tokens have 256 bits of entropy and only their hashes are stored. Sessions
expire after 24 hours and have separate CSRF tokens. Switching workspace rotates
CSRF context and removes old workspace queries while retaining the session query
observer. Stale browser tabs cannot write with the previous CSRF token. Logout
removes the server session and cookie.

Passwords use scrypt with `N=131072`, `r=8`, `p=1`, a random salt and a 64-byte key.
Password work is capped at two concurrent authentication requests. Unknown users
also incur a derivation before rejection. Parameters follow the
[OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Invitations expire after seven days, bind to an email address and are claimed in
a transaction with a row lock. Reissuing/revoking a link invalidates it. Tokens
live in URL fragments and travel to the API in JSON bodies, not query strings.

## Concurrency and persistence

Task updates lock the row, authorize the current user, check the submitted version
and increment it atomically. A stale edit returns HTTP 409. The board optimistically
displays a move, rolls back a rejected write and refetches authoritative data. Only
one board move is submitted at a time. Visible boards poll every 15 seconds;
websocket push is not implemented.

Delivery writes and audit activity share transactions. Public endpoints archive
records. Expired demo data is removed in dependency order, followed by orphan demo
users. Real accounts are excluded. Cleanup runs before demo creation and every
30 minutes while the service is awake.

Migrations have versions and checksums. Applied migrations cannot be silently
changed. MySQL DDL has implicit commits, so the first migration uses idempotent
statements and can resume after an interruption.

## Interface and scope

TanStack Query owns server data; React state owns filters, dialogs and pointer
feedback. Workspace IDs begin cache keys. Pages use lazy imports. Forms connect
labels and field errors; native dialogs restore focus. Mobile navigation makes
background content inert and traps focus while open. Status selects complement
drag-and-drop for touch/keyboard users. Reduced motion removes entrance animation.

Lists are bounded to 200 clients, 200 projects, 300 tasks per project and 100
workspace members. One service instance and a single trusted ingress proxy are
assumed. Multiple instances would need a shared limiter, coordinated cleanup and
operational monitoring. Recovery and email verification require separate features.
