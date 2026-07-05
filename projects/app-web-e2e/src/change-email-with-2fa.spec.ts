import { expect, test } from '@playwright/test';

// quarantined by #212: the 2fa gate intermittently drops the pin input's
// filled value, and retries hit the logged-in-elsewhere interstitial because
// mock-db sessions persist across attempts
test.fixme('it changes email for a user with 2FA', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/login/);

  await page.getByLabel('Email').fill('e2e-change-email-2fa-user@test.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  await page.getByTestId('otp-input').fill('999999');
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/nexus/);

  await page.getByRole('link', { name: 'Account' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account/);

  await page.getByRole('link', { exact: true, name: 'Change Email' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  await page.getByTestId('otp-input').fill('999999');
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account\/change-email/);

  const newEmail = `new-email-2fa-${Date.now()}@test.com`;

  await page.getByLabel('New Email Address').fill(newEmail);
  await page.getByRole('button', { name: 'Change Email' }).click();

  await expect(page).toHaveURL(/localhost:4000\/verify-otp/);

  await page.getByTestId('otp-input').fill('999999');
  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/localhost:4000\/account$/);
  await expect(page.getByText(newEmail)).toBeVisible();
});
