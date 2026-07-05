import { expect, test } from '@playwright/test';

test('it changes password for a user with 2FA', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/login/);

  await page.getByLabel('Email').fill('e2e-change-password-2fa-user@test.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  // typed per digit — a multi-character fill races the pin input's paste handling (#212)
  await page.getByTestId('otp-input').pressSequentially('999999', { delay: 50 });
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/nexus/);

  await page.getByRole('link', { name: 'Account' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account/);

  await page.getByRole('link', { exact: true, name: 'Change Password' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  // typed per digit — a multi-character fill races the pin input's paste handling (#212)
  await page.getByTestId('otp-input').pressSequentially('999999', { delay: 50 });
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account\/change-password/);

  await page.getByLabel('Current Password').fill('password');
  await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
  await page.getByLabel('Confirm New Password').fill('newpassword123');
  await page.getByRole('button', { name: 'Change Password' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account$/);

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/localhost:4000\//);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Email').fill('e2e-change-password-2fa-user@test.com');
  await page.getByLabel('Password').fill('newpassword123');
  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  // typed per digit — a multi-character fill races the pin input's paste handling (#212)
  await page.getByTestId('otp-input').pressSequentially('999999', { delay: 50 });
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/nexus/);
});
