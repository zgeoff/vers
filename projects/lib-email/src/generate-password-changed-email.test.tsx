import { expect, test } from 'vitest';
import { generatePasswordChangedEmail } from './generate-password-changed-email';

test('it generates a password changed email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const email = await generatePasswordChangedEmail(config);

  expect(email.html).include('Your password has been changed');
  expect(email.html).include('test@example.com');

  expect(email.plainText).include('YOUR PASSWORD HAS BEEN CHANGED');
  expect(email.plainText).include('test@example.com');
});
