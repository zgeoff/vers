import { expect, test } from 'bun:test';
import { SendChangeEmailNotificationInputSchema } from './send-change-email-notification-input-schema';

test('it accepts a well-formed change-email notification input', () => {
  const result = SendChangeEmailNotificationInputSchema.safeParse({ to: 'player@example.com' });

  expect(result.success).toBeTrue();
});

test('it rejects a to address that is not a valid email', () => {
  const result = SendChangeEmailNotificationInputSchema.safeParse({ to: 'not-an-email' });

  expect(result.success).toBeFalse();
});
