import { expect, test } from 'bun:test';
import { renderChangeEmailNotificationEmail } from './render-change-email-notification-email';

test('it renders a notification email with the correct content', () => {
  const email = renderChangeEmailNotificationEmail();

  expect(email.html).toContain('Your email address has been changed');
  expect(email.plainText).toContain('YOUR EMAIL ADDRESS HAS BEEN CHANGED');
});
