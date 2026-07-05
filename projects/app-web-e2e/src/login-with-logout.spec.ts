import { expect, test } from '@playwright/test';

test('it logs in a user and prompts them to logout their previous sessions', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/login/);

  await page.getByLabel('Email').fill(`e2e-login-logout-user@test.com`);
  await page.getByLabel('Password').fill(`password`);
  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/login\/force-logout/);
  await expect(page.getByText('You are logged in elsewhere')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page).toHaveURL(/localhost:4000\/nexus/);
});
