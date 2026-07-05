import { expect, test } from 'vitest';
import { generateChangeEmailNotificationEmail } from './generate-change-email-notification';

test('it generates a notification email with the correct content', async () => {
  const { html, plainText } = await generateChangeEmailNotificationEmail();

  expect(html).toContain('Your email address has been changed');

  expect(plainText).toContain('YOUR EMAIL ADDRESS HAS BEEN CHANGED');
});
