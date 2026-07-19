import { buildAvatarName } from '../src/support/build-avatar-name';
import { runSignUpIntoGame } from '../src/support/run-sign-up-into-game';
import { expect, test } from '../src/support/test';
import type { JourneyAccount } from '../src/support/types';

/**
 * Exercises the home route against a live server, past what `bun test` can drive (it resolves
 * package exports without the `react-server` condition, and there's no live request's
 * `AsyncLocalStorage` context). The hero renders its content client-side behind `!query.isPending`,
 * so this checks the served HTML response (200, `text/html`) and the client-rendered signed-out
 * actions, not server-rendered content.
 */
test('it serves the home page and renders the signed-out actions', async ({ page, request }) => {
  const rawResponse = await request.get('/');

  expect(rawResponse.status()).toBe(200);
  expect(rawResponse.headers()['content-type']).toContain('text/html');

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to vers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
});

test('it renders the signed-in home page for a fresh account', async ({
  page,
  waitForVerificationCode,
}) => {
  const runID = Date.now();

  const account: JourneyAccount = {
    avatarName: buildAvatarName(),
    email: `e2e-home-${runID}@vers.test`,
    password: `e2e-password-${runID}`,
    username: `e2ehome${runID}`,
  };

  // the onboarding step sets the display name to 'Journey Account'
  await runSignUpIntoGame(page, account, waitForVerificationCode);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome back, Journey Account.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeHidden();
});
