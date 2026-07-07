import { expect, test } from 'vitest';
import { generateTwoFactorEmail } from './generate-two-factor-email';

test('it generates a two-factor email with the provided configuration', async () => {
  const config = {
    verificationCode: '123456',
  };

  const email = await generateTwoFactorEmail(config);

  expect(email.html).include('Your two-factor sign-in code');
  expect(email.html).include(config.verificationCode);

  expect(email.plainText).include('YOUR TWO-FACTOR SIGN-IN CODE');
  expect(email.plainText).include(config.verificationCode);
});
