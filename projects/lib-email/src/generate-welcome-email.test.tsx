import { expect, test } from 'vitest';
import { generateWelcomeEmail } from './generate-welcome-email';

test('it generates a welcome email with the provided configuration', async () => {
  const config = {
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verification?token=123456',
  };

  const { html, plainText } = await generateWelcomeEmail(config);

  expect(html).include('Welcome to vers');
  expect(html).include(config.verificationCode);
  expect(html).include(config.verificationURL);

  expect(plainText).include('WELCOME TO VERS');
  expect(plainText).include(config.verificationCode);
  expect(plainText).include(config.verificationURL);
});
