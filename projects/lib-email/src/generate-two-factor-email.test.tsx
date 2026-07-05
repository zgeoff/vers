import { expect, test } from 'vitest';
import { generateTwoFactorEmail } from './generate-two-factor-email';

test('it generates a two-factor email with the provided configuration', async () => {
  const config = {
    verificationCode: '123456',
  };

  const { html, plainText } = await generateTwoFactorEmail(config);

  expect(html).include('Your two-factor sign-in code');
  expect(html).include(config.verificationCode);

  expect(plainText).include('YOUR TWO-FACTOR SIGN-IN CODE');
  expect(plainText).include(config.verificationCode);
});
