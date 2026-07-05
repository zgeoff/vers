import { expect, test } from '@playwright/test';

test('it logs in a user with 2FA and displays the nexus', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/login/);

  await fixtures.page.getByLabel('Email').fill(`e2e-2fa-user@test.com`);
  await fixtures.page.getByLabel('Password').fill(`password`);
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);
});
