import { expect, test } from '@playwright/test';

test('it enables 2FA for a user', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/login/);

  await fixtures.page.getByLabel('Email').fill(`e2e-enable-2fa-user@test.com`);
  await fixtures.page.getByLabel('Password').fill(`password`);
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);

  await fixtures.page.getByRole('link', { name: 'Account' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account/);

  await fixtures.page.getByRole('button', { name: 'Enable 2FA' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account\/2fa/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Submit' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account/);
  await expect(fixtures.page.getByText('You have enabled two-factor authentication')).toBeVisible();
});
