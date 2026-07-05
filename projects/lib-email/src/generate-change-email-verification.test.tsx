import { expect, test } from 'vitest';
import { generateChangeEmailVerificationEmail } from './generate-change-email-verification';

test('it generates a verification email with the provided configuration', async () => {
  const config = {
    newEmail: 'new-email@example.com',
    verificationCode: '123456',
    verificationURL: 'https://example.com/verify?code=123456',
  };

  const { html, plainText } = await generateChangeEmailVerificationEmail(config);

  expect(html).toContain('Verify your new email address');
  expect(html).toContain(config.newEmail);
  expect(html).toContain(config.verificationCode);
  expect(html).toContain(config.verificationURL);

  expect(plainText).toContain('VERIFY YOUR NEW EMAIL ADDRESS');
  expect(plainText).toContain(config.newEmail);
  expect(plainText).toContain(config.verificationCode);
  expect(plainText).toContain(config.verificationURL);
});
