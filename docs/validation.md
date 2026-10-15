# Validation record

## Verified release — 15 October 2026

Application code: `e4c4c04735486035ac24ea7f1b050aefba026319`.

[Successful CI run](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38779591876):

- Shared, API and web production builds; separate GitHub Pages build.
- Strict application and test types, ESLint with zero warnings and Prettier checks.
- **24 passing unit/component tests**, including seven browser-storage adapter tests.
- **17 passing API integration tests** against MySQL 8.4.
- **18 passing server browser scenarios** across Chromium, Firefox and mobile Chromium.
- **21 passing Pages browser scenarios** across the same three browser profiles.

The server browser suite uses the built Node application, real API requests,
cookies and SQL persistence. It checks project persistence, permissions, stale
updates, pagination, keyboard/dialog behavior, responsive navigation, reduced
motion and automated accessibility scans.

The Pages suite verifies direct entry without an API server, project/task edits
surviving deep-link reloads, visitor isolation, reset confirmation, recovery from
unreadable saved data, confirmed viewer-role changes, conflicting edits in two
tabs and recovery from unavailable project links. Automated accessibility scans
cover overview, board, projects, clients and team on all three browser profiles.
The storage unit tests also cover invalid input, reference constraints, version
conflicts, unassigning a new viewer’s tasks and failed writes. Browser tests do
not use retries.

## Quality review fixes

- Making a demo member a viewer now unassigns their tasks and increments task
  versions, matching the confirmation text and Node/MySQL implementation.
- A conflicting edit keeps the visitor’s draft visible, blocks another stale
  save and offers an explicit latest-version reload with restored input focus.
- Unavailable project links show a clear recovery path and hide task creation
  until an available project is selected.

## Public deployment

**[Live demo](https://rafayelkaramyan.github.io/rafnexa/)**

[Successful Pages deployment](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38780077986)
published the application code above after CI passed.

Live browser verification confirmed:

- The HTTPS site opens directly into an editable dashboard without registration.
- A new project appears on the dashboard and remains after a reload.
- A new task can move to Done; its saved status survives a board reload.
- Dashboard progress and completion metrics reflect the saved changes.
- Client creation, editing, reload persistence and archiving work on the live site.
- A confirmed change to Viewer saves successfully and persists after reload.

Public demo data is stored in each visitor's browser. The separately runnable
Node/MySQL server is not hosted by GitHub Pages.

## Verification limits

Physical mobile devices, native Safari, Docker image execution, a complete manual
accessibility audit, sustained load tests and production Core Web Vitals have not
been verified. No performance benchmark figures are claimed.
