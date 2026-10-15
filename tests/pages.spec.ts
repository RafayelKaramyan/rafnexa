import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function activate(locator: Locator) {
  if (test.info().project.name !== 'mobile-chromium') {
    await locator.click();
    return;
  }
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.scrollIntoViewIfNeeded();
  const point = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x: x - (window.visualViewport?.offsetLeft ?? 0),
      y: y - (window.visualViewport?.offsetTop ?? 0),
      unobscured: hit === element || (hit !== null && element.contains(hit)),
    };
  });
  expect(point.unobscured).toBe(true);
  await locator.page().touchscreen.tap(point.x, point.y);
}
async function navigate(page: Page, name: string) {
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await toggle.isVisible()) await activate(toggle);
  await activate(page.getByRole('link', { name, exact: true }));
}
async function open(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'A clear view, Demo.' })).toBeVisible();
}
test('opens directly without a backend and has accessible core screens', async ({ page }, info) => {
  const apiRequests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await expect(
    page.getByText('Interactive demo. Changes are saved in this browser.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('pages-overview.png'), fullPage: true });
  await navigate(page, 'Task board');
  await expect(page.getByRole('combobox', { name: 'Board project' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});
test('persists projects and task moves through deep-link reloads', async ({ page }, info) => {
  await open(page);
  await navigate(page, 'Projects');
  await activate(page.getByRole('button', { name: 'New project', exact: true }));
  await expect(page.getByRole('textbox', { name: 'Project name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Project name' }).fill('Launch review');
  await activate(page.getByRole('button', { name: 'Create project', exact: true }));
  await expect(page.getByRole('link', { name: 'Open Launch review' })).toBeVisible();
  await navigate(page, 'Task board');
  await page
    .getByRole('combobox', { name: 'Board project' })
    .selectOption({ label: 'Launch review' });
  await activate(page.getByRole('button', { name: 'New task', exact: true }));
  await page.getByRole('textbox', { name: 'Task title' }).fill('Ship the portfolio demo');
  await activate(page.getByRole('button', { name: 'Create task', exact: true }));
  const move = page.getByRole('combobox', { name: 'Move Ship the portfolio demo', exact: true });
  await move.selectOption('done');
  await expect(move).toHaveValue('done');
  const deepLink = page.url();
  await page.reload();
  await expect(move).toHaveValue('done');
  expect(page.url()).toBe(deepLink);
  await page.screenshot({ path: info.outputPath('pages-board.png'), fullPage: true });
  await navigate(page, 'Projects');
  await page.getByRole('textbox', { name: 'Search projects' }).fill('Launch review');
  await expect(page.getByRole('link', { name: 'Open Launch review' })).toBeVisible();
});
test('isolates visitors and asks before resetting their changes', async ({ page, browser }) => {
  await open(page);
  await navigate(page, 'Clients');
  await activate(page.getByRole('button', { name: 'Add client', exact: true }));
  await page.getByRole('textbox', { name: 'Client name' }).fill('North studio');
  await activate(page.getByRole('dialog').getByRole('button', { name: 'Add client', exact: true }));
  await expect(page.getByRole('heading', { name: 'North studio', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'North studio', exact: true })).toBeVisible();
  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await other.goto('http://127.0.0.1:4174/rafnexa/#/clients');
    await expect(other.getByRole('heading', { name: 'Studio West', exact: true })).toBeVisible();
    await expect(other.getByRole('heading', { name: 'North studio', exact: true })).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
  await activate(page.getByRole('button', { name: 'Reset demo', exact: true }));
  await activate(page.getByRole('button', { name: 'Keep it', exact: true }));
  await expect(page.getByRole('heading', { name: 'North studio', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: 'Reset demo', exact: true }));
  await activate(page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }));
  await expect(page.getByRole('heading', { name: 'A clear view, Demo.' })).toBeVisible();
  await navigate(page, 'Clients');
  await expect(page.getByRole('heading', { name: 'North studio', exact: true })).toHaveCount(0);
});
test('recovers unreadable saved data through an explicit reset', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('rafnexa:portfolio-demo:v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('The saved demo data could not be read.');
  await activate(page.getByRole('button', { name: 'Reset demo', exact: true }));
  await activate(page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }));
  await expect(page.getByRole('heading', { name: 'A clear view, Demo.' })).toBeVisible();
});
