import { expect, test } from 'vitest';
import { generateExistingAccountEmail } from './generate-existing-account-email';

test('it generates an existing account email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const { html, plainText } = await generateExistingAccountEmail(config);

  expect(html).include('You already have an account');
  expect(html).include('test@example.com');
  expect(html).include('https://versidle.com/forgot-password');

  expect(plainText).include('YOU ALREADY HAVE AN ACCOUNT');
  expect(plainText).include('test@example.com');
  expect(plainText).include('https://versidle.com/forgot-password');
});
