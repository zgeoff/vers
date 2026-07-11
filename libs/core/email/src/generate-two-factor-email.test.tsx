import { expect, test } from 'bun:test';
import { generateTwoFactorEmail } from './generate-two-factor-email';

test('it generates a two-factor email with the provided configuration', async () => {
  const config = {
    verificationCode: '123456',
  };

  const email = await generateTwoFactorEmail(config);

  expect(email.html).toInclude('Your two-factor sign-in code');
  expect(email.html).toInclude(config.verificationCode);
  expect(email.plainText).toInclude('YOUR TWO-FACTOR SIGN-IN CODE');
  expect(email.plainText).toInclude(config.verificationCode);
});
