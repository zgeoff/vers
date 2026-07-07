import { expect, test } from 'vitest';
import { generateExistingAccountEmail } from './generate-existing-account-email';

test('it generates an existing account email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const email = await generateExistingAccountEmail(config);

  expect(email.html).include('You already have an account');
  expect(email.html).include('test@example.com');
  expect(email.html).include('https://versidle.com/forgot-password');

  expect(email.plainText).include('YOU ALREADY HAVE AN ACCOUNT');
  expect(email.plainText).include('test@example.com');
  expect(email.plainText).include('https://versidle.com/forgot-password');
});
