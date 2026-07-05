import { expect, test } from '@playwright/test';

test('it logs in a user and displays the nexus', async (fixtures) => {
  await fixtures.page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await fixtures.page.goto('/');
  await fixtures.page.getByRole('link', { name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/login/);

  await fixtures.page.getByLabel('Email').fill(`e2e-user@test.com`);
  await fixtures.page.getByLabel('Password').fill(`password`);
  await fixtures.page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(fixtures.page).toHaveURL(/localhost:4000\/nexus/);
});
