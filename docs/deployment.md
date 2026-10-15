# Deployment

## Public portfolio demo: GitHub Pages

**[Open Rafnexa](https://rafayelkaramyan.github.io/rafnexa/)** — deployed and
verified on 15 October 2026.

The public showcase is a static React application, built with `npm run build:pages`.
It opens directly into the sample workspace and persists edits in browser storage.
It does not need Render, a database account, secrets or an authentication provider.

In repository Settings → Pages, choose GitHub Actions as the publishing source.
`.github/workflows/pages.yml` deploys `apps/web/dist` only after a successful
`Continuous integration` run for a push to `main`. Vite's `pages` mode sets
`/rafnexa/` as the asset base and enables the browser storage adapter. Hash routing
keeps reloads and shared project/board routes compatible with static hosting.

CI tests the server build and the static Pages build separately. The Pages browser
suite verifies direct entry, persistence, visitor isolation, accessible screens,
reset confirmation and recovery from invalid saved data, without an API server.

The local demo is a portfolio presentation. Online accounts, cross-device sharing,
real invitations and server authorization belong to the separate server mode.
The [successful deployment](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38780077986)
published the tested application. Live checks confirmed project creation and a
task moved to Done persisted after a page reload.

## Optional server deployment

These instructions describe the existing Node/MySQL application. They are not
required to run or review the portfolio demo.

Run one Node service and an external MySQL database. `Dockerfile` provides a
non-root runtime image; `render.yaml` describes a free service. Configuration files
are not evidence of a successful live deployment.

Build: `npm ci --include=dev && npm run build`. Start:
`node apps/api/dist/migrate.js && npm start`. Use `/api/health` for readiness.
Start from the repository root. The host supplies `PORT`; SIGTERM/SIGINT trigger
shutdown with a ten-second deadline.

| Variable           | Production value                                                      |
| ------------------ | --------------------------------------------------------------------- |
| `NODE_ENV`         | `production`                                                          |
| `PUBLIC_ORIGIN`    | Exact HTTPS application origin without a path                         |
| `DATABASE_URL`     | Private `mysql://` connection string in host secrets                  |
| `DATABASE_SSL`     | `true` for remote databases                                           |
| `DATABASE_CA_CERT` | Provider CA PEM certificate when required; escaped newlines supported |
| `COOKIE_SECURE`    | `true`                                                                |
| `PORT`             | Host-assigned port                                                    |

Never commit credentials or disable certificate verification. The service assumes
one trusted ingress proxy. Review `trust proxy` for a different deployment topology.

Render can host Node and Aiven can supply MySQL on free tiers. Verify current limits:
[Render](https://render.com/docs/free),
[Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).
Free instances can sleep. Provision no paid resources for the demo.

CI checks build, test-code types, lint, formatting, unit/component tests, MySQL 8.4
integration and browsers. Tie deployment to passing checks. After deployment,
verify HTTPS login, demo creation, a task move surviving reload and CSRF rejection.

`NODE_ENV=test` disables rate limits for automated browsers and must not be used
publicly. A larger deployment should separate migration and runtime database
identities, add backups and monitor service health.
