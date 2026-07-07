import { expect, test } from 'vitest';
import { generateWelcomeEmail } from './generate-welcome-email';

test('it generates a welcome email with the provided configuration', async () => {
  const config = {
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verification?token=123456',
  };

  const email = await generateWelcomeEmail(config);

  expect(email.html).include('Welcome to vers');
  expect(email.html).include(config.verificationCode);
  expect(email.html).include(config.verificationURL);

  expect(email.plainText).include('WELCOME TO VERS');
  expect(email.plainText).include(config.verificationCode);
  expect(email.plainText).include(config.verificationURL);
});
