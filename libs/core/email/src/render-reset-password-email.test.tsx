import { expect, test } from 'bun:test';
import { renderResetPasswordEmail } from './render-reset-password-email';

test('it renders a reset password email with the provided configuration', async () => {
  const config = {
    resetURL: 'https://versidle.com/reset?token=123456',
  };

  const email = await renderResetPasswordEmail(config);

  expect(email.html).toInclude('Forgot your password?');
  expect(email.html).toInclude('https://versidle.com/reset?token=123456');
  expect(email.plainText).toInclude('FORGOT YOUR PASSWORD?');
  expect(email.plainText).toInclude('https://versidle.com/reset?token=123456');
});
