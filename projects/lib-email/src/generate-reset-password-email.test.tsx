import { expect, test } from 'vitest';
import { generateResetPasswordEmail } from './generate-reset-password-email';

test('it generates a reset password email with the provided configuration', async () => {
  const config = {
    resetURL: 'https://versidle.com/reset?token=123456',
  };

  const { html, plainText } = await generateResetPasswordEmail(config);

  expect(html).include('Forgot your password?');
  expect(html).include('https://versidle.com/reset?token=123456');

  expect(plainText).include('FORGOT YOUR PASSWORD?');
  expect(plainText).include('https://versidle.com/reset?token=123456');
});
