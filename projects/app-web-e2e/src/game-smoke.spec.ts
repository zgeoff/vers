import { expect, test } from '@playwright/test';

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
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Email').fill('e2e-game@vers.test');
  await page.getByLabel('Password').fill('password123');

  // the honeypot rejects any submission under 1.5s old as bot-paced — real typing naturally
  // clears it, a scripted fill+click doesn't
  await page.waitForTimeout(1600);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/);
  await expect(page.getByText(/Destiny Awaits a Vessel|Respite/)).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  await page.goto('/avatar');

  // mock-backend data persists across runs against the same dev server, so the account may or
  // may not already have an avatar
  await expect(page).toHaveURL(/\/avatar(?<create>\/create)?$/);

  await page.goto('/explore');

  await expect(page.locator('canvas')).toBeVisible();

  expect(consoleErrors).toStrictEqual([]);
});
