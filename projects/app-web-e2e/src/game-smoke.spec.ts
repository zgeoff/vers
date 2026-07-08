import { expect, test } from '@playwright/test';

/**
 * Exercises the game surfaces against a live dev server, logging in as the seeded
 * `e2e-game@vers.test` account (its own login, distinct from `home-smoke.spec.ts`'s `dev-session`
 * — signing in as that account instead would force out its already-live session): none of
 * nexus's client-lane Query read, avatar's server-component page, or aether's R3F code-split
 * boundary can run under `bun test` (no live browser, no `react-server` export condition).
 * Tolerant of either avatar state since the mock backend's data persists across runs against the
 * same dev server.
 */
test('it renders nexus, avatar, and aether for a signed-in caller without console errors', async ({
  page,
}) => {
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await page.goto('/nexus');

  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Email').fill('e2e-game@vers.test');
  await page.getByLabel('Password').fill('password123');

  // the honeypot rejects any submission under 1.5s old as bot-paced — real typing naturally
  // clears it, a scripted fill+click doesn't
  await page.waitForTimeout(1600);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/nexus$/);
  await expect(page.getByText(/Destiny Awaits a Vessel|Nexus/)).toBeVisible();

  await page.goto('/avatar');

  await expect(page).toHaveURL(/\/avatar(?<create>\/create)?$/);

  await page.goto('/aether');

  await expect(page.locator('canvas')).toBeVisible();

  expect(consoleErrors).toStrictEqual([]);
});
