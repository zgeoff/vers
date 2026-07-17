import { expect, test } from '@playwright/test';
import { waitForHoneypotWindow } from './wait-for-honeypot-window';

test('it renders respite, avatar, and explore for a signed-in caller without console errors', async ({
  page,
}) => {
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/respite');

  await expect(page).toHaveURL(/\/login/);

  // hydration gate: the login form's submit handler attaches only once React commits; an
  // earlier click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-game@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/);
  await expect(page.getByText(/Destiny Awaits a Vessel|Respite/)).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  // guard against the app shipping without its generated stylesheet: at least one sheet must be
  // linked, preflight must have applied (body margin reset), and the preset's global token
  // variables must resolve
  const styleProbe = await page.evaluate(() => ({
    bodyMargin: getComputedStyle(document.body).margin,
    fontBodyVar: getComputedStyle(document.documentElement)
      .getPropertyValue('--global-font-body')
      .trim(),
    sheetCount: document.styleSheets.length,
  }));

  expect(styleProbe.sheetCount).toBeGreaterThan(0);
  expect(styleProbe.bodyMargin).toBe('0px');
  expect(styleProbe.fontBodyVar).not.toBe('');

  await page.goto('/avatar');

  // mock-backend data persists across runs against the same dev server, so the account may or
  // may not already have an avatar
  await expect(page).toHaveURL(/\/avatar(?<create>\/create)?$/);

  await page.goto('/explore');

  await expect(page.locator('canvas')).toBeVisible();

  expect(consoleErrors).toStrictEqual([]);
});
