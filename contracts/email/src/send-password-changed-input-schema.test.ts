import { expect, test } from 'bun:test';
import { SendPasswordChangedInputSchema } from './send-password-changed-input-schema';

test('it accepts a well-formed password-changed input', () => {
  const result = SendPasswordChangedInputSchema.safeParse({
    email: 'player@example.com',
    to: 'player@example.com',
  });

  expect(result.success).toBeTrue();
});

test('it rejects an email that is not a valid address', () => {
  const result = SendPasswordChangedInputSchema.safeParse({
    email: 'not-an-email',
    to: 'player@example.com',
  });

  expect(result.success).toBeFalse();
});
