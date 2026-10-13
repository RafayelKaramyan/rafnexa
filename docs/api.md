# API contract

JSON endpoints use `/api`. No cross-origin CORS access is granted. Authenticated
requests use an HttpOnly cookie. Writes need the configured `Origin`; authenticated
writes also need `X-CSRF-Token` from the current session. POST/PUT/PATCH require JSON.

| Resource          | Endpoints                                                                                               | Write access                           |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Sessions          | `GET /auth/session`, `POST /auth/login`, `/auth/register`, `/auth/demo`, `/auth/logout`, `/auth/switch` | Current user                           |
| Invite acceptance | `POST /auth/invitation`, `/auth/accept-invitation`                                                      | Email-bound invitee                    |
| Dashboard         | `GET /dashboard`                                                                                        | Read only                              |
| Projects          | `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`                                                    | Owner/admin                            |
| Task list         | `GET /projects/:id/tasks`                                                                               | Read only                              |
| Tasks             | `POST /tasks`, `PATCH/DELETE /tasks/:id`                                                                | Owner/admin; assigned member may PATCH |
| Clients           | `GET/POST /clients`, `PUT/DELETE /clients/:id`                                                          | Owner/admin                            |
| Members           | `GET /members`, `PATCH /members/:id`                                                                    | Owner/admin, with role restrictions    |
| Invitations       | `GET/POST /invitations`, `DELETE /invitations/:id`                                                      | Owner/admin, with role restrictions    |
| Health            | `GET /health`                                                                                           | Public database readiness              |

Project queries accept `q`, `status`, `page`, `pageSize` (1–50), returning
`{ items, total, page, pageSize }`. Task PATCH requires a `version` and at least one
changed field. Task DELETE requires `{ version }`. Other resource DELETEs archive
records and return 204; invitation DELETE revokes a link.

Authentication returns `{ user, workspace, workspaces, csrfToken }`; session tokens
never appear in JSON. Invitation creation returns its token once for copying.

Errors return `{ error: { code, message, requestId, fields? } }`. Validation uses
422, unavailable/cross-workspace records 404, unauthorized roles 403, expired
sessions 401, conflicts 409, and rate limits 429. Shared Zod schemas are authoritative
for fields and enum values.
