import { expect, test } from 'bun:test';
import { renderExistingAccountEmail } from './render-existing-account-email';

test('it renders an existing account email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const email = await renderExistingAccountEmail(config);

  expect(email.html).toInclude('You already have an account');
  expect(email.html).toInclude('test@example.com');
  expect(email.html).toInclude('https://versidle.com/forgot-password');
  expect(email.plainText).toInclude('YOU ALREADY HAVE AN ACCOUNT');
  expect(email.plainText).toInclude('test@example.com');
  expect(email.plainText).toInclude('https://versidle.com/forgot-password');
});
