import { expect, test } from 'bun:test';
import { generateResetPasswordEmail } from './generate-reset-password-email';

test('it generates a reset password email with the provided configuration', async () => {
  const config = {
    resetURL: 'https://versidle.com/reset?token=123456',
  };

  const email = await generateResetPasswordEmail(config);

  expect(email.html).toInclude('Forgot your password?');
  expect(email.html).toInclude('https://versidle.com/reset?token=123456');

  expect(email.plainText).toInclude('FORGOT YOUR PASSWORD?');
  expect(email.plainText).toInclude('https://versidle.com/reset?token=123456');
});
