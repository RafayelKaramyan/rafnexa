import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import type { Session, Task, Project } from '@rafnexa/shared';

async function demo(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Enter demo workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A clear view, Demo.' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
}
async function navigate(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function session(page: Page) {
  const result = await page.request.get('/api/auth/session');
  expect(result.ok()).toBeTruthy();
  return result.json() as Promise<Session>;
}
const origin = 'http://127.0.0.1:4173';
test('loads a real demo, exposes metrics and adapts to the viewport', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await demo(page);
  await expect(page.getByText('Active projects', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Completed tasks over eight weeks/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  if (info.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
    await page.getByRole('link', { name: 'Rafnexa overview' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Rafnexa overview' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  }
  await page.screenshot({ path: info.outputPath('overview.png'), fullPage: true });
});
test('filters, creates and persists projects with an accessible dialog', async ({ page }) => {
  await demo(page);
  await navigate(page, 'Projects');
  await page.getByRole('textbox', { name: 'Search projects' }).fill('Design system');
  await expect(page.getByRole('link', { name: 'Open Design system v2' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Customer portal' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('completed');
  await expect(page.getByText('No projects match')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Project name' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project name' }).fill('Interview delivery');
  await page.getByRole('combobox', { name: 'Project status' }).selectOption('active');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Interview delivery' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open Interview delivery' })).toBeVisible();
});
test('moves tasks, persists changes and recovers from a stale edit', async ({ page }, info) => {
  await demo(page);
  await navigate(page, 'Task board');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Ship verified workflow');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const control = page.getByRole('combobox', { name: 'Move Ship verified workflow', exact: true });
  await control.selectOption('in_progress');
  await expect(control).toHaveValue('in_progress');
  await page.reload();
  await expect(control).toHaveValue('in_progress');
  const current = await session(page);
  const projectId = await page.getByRole('combobox', { name: 'Board project' }).inputValue();
  const tasks = (await (
    await page.request.get(`/api/projects/${projectId}/tasks`)
  ).json()) as Task[];
  const task = tasks.find((item) => item.title === 'Ship verified workflow')!;
  const update = await page.request.patch(`/api/tasks/${task.id}`, {
    headers: { Origin: origin, 'X-CSRF-Token': current.csrfToken },
    data: { version: task.version, status: 'in_review' },
  });
  expect(update.status()).toBe(200);
  await control.selectOption('done');
  await expect(page.getByRole('alert')).toContainText('This task changed in another session.');
  await expect(control).toHaveValue('in_review');
  await control.selectOption('done');
  await expect(control).toHaveValue('done');
  await page.reload();
  await expect(control).toHaveValue('done');
  await page.screenshot({ path: info.outputPath('task-board.png'), fullPage: true });
});
test('checks pagination and project details against persisted data', async ({ page }) => {
  await demo(page);
  const current = await session(page);
  for (let index = 0; index < 6; index++) {
    const response = await page.request.post('/api/projects', {
      headers: { Origin: origin, 'X-CSRF-Token': current.csrfToken },
      data: {
        name: `Pagination project ${index}`,
        clientId: null,
        status: 'planned',
        dueDate: null,
      },
    });
    expect(response.status()).toBe(201);
  }
  await navigate(page, 'Projects');
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('link', { name: 'Open Pagination project 0' }).click();
  await expect(page.getByRole('heading', { name: 'Pagination project 0.' })).toBeVisible();
  await expect(page.getByText('Turn plans into steps')).toBeVisible();
});
test('enforces viewer permissions in the interface and the API', async ({ page }) => {
  await page.goto('/login');
  const uid = randomUUID();
  const register = await page.request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: {
      name: 'Workspace Owner',
      email: `owner-${uid}@example.com`,
      password: 'a-long-browser-test-password',
      workspaceName: 'Role checks',
    },
  });
  expect(register.status()).toBe(200);
  const owner = (await register.json()) as Session;
  const headers = { Origin: origin, 'X-CSRF-Token': owner.csrfToken };
  const project = await page.request.post('/api/projects', {
    headers,
    data: { name: 'Viewer project', clientId: null, status: 'active', dueDate: null },
  });
  const record = (await project.json()) as Project;
  await page.request.post('/api/tasks', {
    headers,
    data: {
      title: 'A visible read-only task',
      projectId: record.id,
      assigneeId: owner.user.id,
      status: 'todo',
      priority: 'low',
      dueDate: null,
    },
  });
  const invitation = await page.request.post('/api/invitations', {
    headers,
    data: { email: `viewer-${uid}@example.com`, role: 'viewer' },
  });
  expect(invitation.status()).toBe(201);
  const invite = (await invitation.json()) as { token: string };
  const viewer = await page.request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: {
      name: 'Workspace Viewer',
      email: `viewer-${uid}@example.com`,
      password: 'a-long-browser-test-password',
      invitationToken: invite.token,
    },
  });
  expect(viewer.status()).toBe(200);
  const viewerSession = (await viewer.json()) as Session;
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'Open Viewer project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toHaveCount(0);
  await navigate(page, 'Task board');
  await expect(page.getByText('A visible read-only task', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Move A visible read-only task' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0);
  const blocked = await page.request.post('/api/projects', {
    headers: { Origin: origin, 'X-CSRF-Token': viewerSession.csrfToken },
    data: { name: 'Unauthorized', clientId: null, status: 'active', dueDate: null },
  });
  expect(blocked.status()).toBe(403);
});
test('supports reduced motion and semantic accessibility on core screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await demo(page);
  const duration = await page
    .locator('.metric-card')
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  const overview = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    overview.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await navigate(page, 'Task board');
  const board = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    board.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
