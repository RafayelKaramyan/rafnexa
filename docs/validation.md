# Validation record

## Completed locally

- Production build of shared, API and web packages.
- 17 unit/component tests, including a regression for session observer updates
  and removal of previous workspace data.
- 17 API integration tests against disposable MariaDB 10.11.14, covering tenant
  isolation, roles, CSRF, task conflicts, invitation replay and demo cleanup.

MariaDB checks are additional SQL compatibility evidence. Target MySQL 8.4 is
configured independently in GitHub Actions.

## In progress

All six desktop Chromium scenarios passed locally, including the automated
accessibility scans of overview and task board. Firefox could not create a local
browser page in this execution environment; its verification is delegated to CI.
Mobile Chromium and MySQL 8.4 CI results are pending.

Chromium, Firefox and mobile Chromium tests are authored against the built app,
real API and SQL. Browser execution exposed dialog focus and foreground contrast
issues; fixes are under verification. Authored coverage alone is not a passing result.

CI and live deployment results are pending. Docker image execution, physical
mobile devices, native Safari, sustained load and production Core Web Vitals have
not been verified. No benchmark numbers are claimed.
