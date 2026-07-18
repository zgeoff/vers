import { expect, test } from 'bun:test';
import { renderWelcomeEmail } from './render-welcome-email';

test('it renders a welcome email with the provided configuration', () => {
  const config = {
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verification?token=123456',
  };

  const email = renderWelcomeEmail(config);

  expect(email.html).toInclude('Welcome to vers');
  expect(email.html).toInclude(config.verificationCode);
  expect(email.html).toInclude(config.verificationURL);
  expect(email.plainText).toInclude('WELCOME TO VERS');
  expect(email.plainText).toInclude(config.verificationCode);
  expect(email.plainText).toInclude(config.verificationURL);
});
