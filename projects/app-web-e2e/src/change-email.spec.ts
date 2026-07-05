import { expect, test } from '@playwright/test';

test('it changes email for a user without 2FA', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/login/);

  await fixtures.page.getByLabel('Email').fill('e2e-change-email-user@test.com');
  await fixtures.page.getByLabel('Password').fill('password');
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);

  await fixtures.page.getByRole('link', { name: 'Account' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account/);

  await fixtures.page.getByRole('link', { exact: true, name: 'Change Email' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account\/change-email/);

  const newEmail = `new-email-${Date.now()}@test.com`;

  await fixtures.page.getByLabel('New Email Address').fill(newEmail);
  await fixtures.page.getByRole('button', { name: 'Change Email' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account$/);
  await expect(fixtures.page.getByText(newEmail)).toBeVisible();
});
