import { expect, test } from 'vitest';
import { generateResetPasswordEmail } from './generate-reset-password-email';

test('it generates a reset password email with the provided configuration', async () => {
  const config = {
    resetURL: 'https://versidle.com/reset?token=123456',
  };

  const email = await generateResetPasswordEmail(config);

  expect(email.html).include('Forgot your password?');
  expect(email.html).include('https://versidle.com/reset?token=123456');

  expect(email.plainText).include('FORGOT YOUR PASSWORD?');
  expect(email.plainText).include('https://versidle.com/reset?token=123456');
});
