import { expect, test } from 'bun:test';
import { SendExistingAccountInputSchema } from './send-existing-account-input-schema';

test('it accepts a well-formed existing-account input', () => {
  const result = SendExistingAccountInputSchema.safeParse({
    email: 'player@example.com',
    to: 'player@example.com',
  });

  expect(result.success).toBeTrue();
});

test('it rejects an email that is not a valid address', () => {
  const result = SendExistingAccountInputSchema.safeParse({
    email: 'not-an-email',
    to: 'player@example.com',
  });

  expect(result.success).toBeFalse();
});
