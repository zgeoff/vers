import { expect, test } from 'bun:test';
import { generatePasswordChangedEmail } from './generate-password-changed-email';

test('it generates a password changed email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const email = await generatePasswordChangedEmail(config);

  expect(email.html).toInclude('Your password has been changed');
  expect(email.html).toInclude('test@example.com');
  expect(email.plainText).toInclude('YOUR PASSWORD HAS BEEN CHANGED');
  expect(email.plainText).toInclude('test@example.com');
});
