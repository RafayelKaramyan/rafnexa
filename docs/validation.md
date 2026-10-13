# Validation record

## Verified release code

Code commit: `d4b8f57ae6fb588d458612f3a096d2c150970514`.

[Successful CI run](https://github.com/RafayelKaramyan/rafnexa/actions/runs/38474468301):

- Production build of the shared, API and web packages.
- Strict type checking of application and test code.
- ESLint with zero warnings and Prettier formatting checks.
- 17 passing unit/component tests.
- 17 passing API integration tests against MySQL 8.4.
- 18 passing browser scenarios: six each in Chromium, Firefox and mobile Chromium.
- Automated WCAG-tagged accessibility scans of overview and task board.
- Reduced-motion behavior, native dialog focus, mobile navigation focus trapping,
  project persistence, pagination, viewer restrictions and stale-task recovery.

The browser tests run the built Node application with real API requests, cookies
and SQL persistence. They do not mock the backend. Mobile touch input uses DOM
bounds converted to visual viewport coordinates after a pan, retaining visibility,
enabled-state and hit-target checks. There are no forced DOM clicks or test retries.

Additional local evidence includes 17 SQL integration tests against MariaDB 10.11.14.
Local Firefox could not create a page in the execution environment; CI independently
verified Firefox.

## Remaining verification

Public hosting and a live demo are pending. Docker image execution, physical
mobile devices, native Safari, a complete manual accessibility audit, sustained
load tests and production Core Web Vitals have not been verified. No performance
benchmark figures are claimed.

The development environment disconnected after the source was saved to GitHub.
Release code and validation evidence remain available in the repository.
