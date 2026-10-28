import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

test('it creates a second avatar, switches back, and keeps the choice across a reload', async ({
  page,
}) => {
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-avatar-roster@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  // the seeded account carries an active avatar, so the gate lands it in-game
  await expect(page).toHaveURL(/\/respite$/u);

  // the rail chip names the active avatar and opens the roster
  await page.getByRole('link', { name: 'Switch avatar (RosterPrime)' }).click();

  await expect(page).toHaveURL(/\/avatars$/u);

  await page.getByRole('link', { name: '+ Create avatar' }).click();

  await expect(page).toHaveURL(/\/avatars\/create$/u);

  await page.getByLabel('Name').fill('RosterSecond');
  await page.getByRole('button', { exact: true, name: 'Create Avatar' }).click();

  // creating selects the newcomer and re-enters the game as them
  await expect(page).toHaveURL(/\/explore$/u);
  await expect(page.getByRole('link', { name: 'Switch avatar (RosterSecond)' })).toBeVisible();

  // switch back to the first avatar from the roster
  await page.getByRole('link', { name: 'Switch avatar (RosterSecond)' }).click();

  await expect(page).toHaveURL(/\/avatars$/u);

  const rosterCards = page.getByRole('button', { name: /Roster/u });

  await expect(rosterCards).toHaveCount(2);
  await expect(page.getByRole('button', { name: /RosterSecond/u })).toContainText('Active');

  await page.getByRole('button', { name: /RosterPrime/u }).click();

  await expect(page).toHaveURL(/\/explore$/u);
  await expect(page.getByRole('link', { name: 'Switch avatar (RosterPrime)' })).toBeVisible();

  // the selection is server-persisted: a fresh document load still enters as the switched avatar
  await page.reload();

  await expect(page.getByRole('link', { name: 'Switch avatar (RosterPrime)' })).toBeVisible();
});
