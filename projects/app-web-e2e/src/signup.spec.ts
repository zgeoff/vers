import { expect, test } from '@playwright/test';

test('it signs the user up and displays the nexus', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Signup' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/signup/);

  await fixtures.page.getByLabel('Email').fill(`user_${Date.now()}@example.com`);
  await fixtures.page.getByRole('button', { exact: true, name: 'Signup' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/verify-otp/);

  await fixtures.page.getByTestId('otp-input').fill('999999');
  await fixtures.page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/onboarding/);

  await fixtures.page.getByLabel('Username').fill('john_smith');
  await fixtures.page.getByLabel('Name', { exact: true }).fill('John Smith');
  await fixtures.page.getByLabel('Password', { exact: true }).fill('password123!');
  await fixtures.page.getByLabel('Confirm password').fill('password123!');

  // the real checkbox input is visually hidden, so a label-targeted click
  // never becomes actionable — click the visible label text instead
  await fixtures.page.getByText('Agree to terms').click();
  await expect(fixtures.page.getByLabel('Agree to terms')).toBeChecked();
  await fixtures.page.getByRole('button', { name: 'Create an account' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);
});
