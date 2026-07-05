import { expect, test } from 'vitest';
import { generatePasswordChangedEmail } from './generate-password-changed-email';

test('it generates a password changed email with the provided configuration', async () => {
  const config = {
    email: 'test@example.com',
  };

  const { html, plainText } = await generatePasswordChangedEmail(config);

  expect(html).include('Your password has been changed');
  expect(html).include('test@example.com');

  expect(plainText).include('YOUR PASSWORD HAS BEEN CHANGED');
  expect(plainText).include('test@example.com');
});
