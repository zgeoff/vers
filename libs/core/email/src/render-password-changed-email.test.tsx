import { expect, test } from 'bun:test';
import { renderPasswordChangedEmail } from './render-password-changed-email';

test('it renders a password changed email with the provided configuration', () => {
  const config = {
    email: 'test@example.com',
  };

  const email = renderPasswordChangedEmail(config);

  expect(email.html).toInclude('Your password has been changed');
  expect(email.html).toInclude('test@example.com');
  expect(email.plainText).toInclude('YOUR PASSWORD HAS BEEN CHANGED');
  expect(email.plainText).toInclude('test@example.com');
});
