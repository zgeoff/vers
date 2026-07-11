import { expect, test } from 'bun:test';
import { generateChangeEmailVerificationEmail } from './generate-change-email-verification';

test('it generates a verification email with the provided configuration', async () => {
  const config = {
    newEmail: 'new-email@example.com',
    verificationCode: '123456',
    verificationURL: 'https://example.com/verify?code=123456',
  };

  const email = await generateChangeEmailVerificationEmail(config);

  expect(email.html).toContain('Verify your new email address');
  expect(email.html).toContain(config.newEmail);
  expect(email.html).toContain(config.verificationCode);
  expect(email.html).toContain(config.verificationURL);
  expect(email.plainText).toContain('VERIFY YOUR NEW EMAIL ADDRESS');
  expect(email.plainText).toContain(config.newEmail);
  expect(email.plainText).toContain(config.verificationCode);
  expect(email.plainText).toContain(config.verificationURL);
});
