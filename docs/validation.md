# Validation record

## Verified release — 15 October 2026

Application code: `2ae4dcccc7af09497a54dce2ce649472d7d696b3`.

[Successful CI run](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38776194748):

- Shared, API and web production builds; separate GitHub Pages build.
- Strict application and test types, ESLint with zero warnings and Prettier checks.
- **23 passing unit/component tests**, including six browser-storage adapter tests.
- **17 passing API integration tests** against MySQL 8.4.
- **18 passing server browser scenarios** across Chromium, Firefox and mobile Chromium.
- **12 passing Pages browser scenarios** across the same three browser profiles.

The server browser suite uses the built Node application, real API requests,
cookies and SQL persistence. It checks project persistence, permissions, stale
updates, pagination, keyboard/dialog behavior, responsive navigation, reduced
motion and automated accessibility scans.

The Pages suite verifies direct entry without an API server, project/task edits
surviving deep-link reloads, visitor isolation, reset confirmation, recovery from
unreadable saved data and automated accessibility scans of overview and board.
The storage unit tests also cover invalid input, reference constraints, version
conflicts and failed writes. Browser tests do not use retries.

## Public deployment

**[Live demo](https://rafayelkaramyan.github.io/rafnexa/)**

[Successful Pages deployment](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38776593518)
published the application code above after CI passed.

Live browser verification confirmed:

- The HTTPS site opens directly into an editable dashboard without registration.
- A new project appears on the dashboard and remains after a reload.
- A new task can move to Done; its saved status survives a board reload.
- Dashboard progress and completion metrics reflect the saved changes.

Public demo data is stored in each visitor's browser. The separately runnable
Node/MySQL server is not hosted by GitHub Pages.

## Verification limits

Physical mobile devices, native Safari, Docker image execution, a complete manual
accessibility audit, sustained load tests and production Core Web Vitals have not
been verified. No performance benchmark figures are claimed.
