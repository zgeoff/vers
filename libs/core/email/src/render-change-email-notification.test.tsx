import { expect, test } from 'bun:test';
import { renderChangeEmailNotificationEmail } from './render-change-email-notification';

test('it generates a notification email with the correct content', async () => {
  const email = await renderChangeEmailNotificationEmail();

  expect(email.html).toContain('Your email address has been changed');
  expect(email.plainText).toContain('YOUR EMAIL ADDRESS HAS BEEN CHANGED');
});
