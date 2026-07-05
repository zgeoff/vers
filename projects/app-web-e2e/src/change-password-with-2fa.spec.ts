import { expect, test } from '@playwright/test';

test('it changes password for a user with 2FA', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/login/);

  await fixtures.page.getByLabel('Email').fill('e2e-change-password-2fa-user@test.com');
  await fixtures.page.getByLabel('Password').fill('password');
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);

  await fixtures.page.getByRole('link', { name: 'Account' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account/);

  await fixtures.page.getByRole('link', { exact: true, name: 'Change Password' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account\/change-password/);

  await fixtures.page.getByLabel('Current Password').fill('password');
  await fixtures.page.getByLabel('New Password', { exact: true }).fill('newpassword123');
  await fixtures.page.getByLabel('Confirm New Password').fill('newpassword123');
  await fixtures.page.getByRole('button', { name: 'Change Password' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/account$/);

  await fixtures.page.getByRole('button', { name: 'Logout' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\//);

  await fixtures.page.getByRole('link', { name: 'Login' }).click();
  await fixtures.page.getByLabel('Email').fill('e2e-change-password-2fa-user@test.com');
  await fixtures.page.getByLabel('Password').fill('newpassword123');
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);
});
