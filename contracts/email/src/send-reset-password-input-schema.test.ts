import { expect, test } from 'bun:test';
import { SendResetPasswordInputSchema } from './send-reset-password-input-schema';

test('it accepts a well-formed reset-password input', () => {
  const result = SendResetPasswordInputSchema.safeParse({
    resetURL: 'https://versidle.com/reset-password',
    to: 'player@example.com',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a resetURL that is not a valid url', () => {
  const result = SendResetPasswordInputSchema.safeParse({
    resetURL: 'not-a-url',
    to: 'player@example.com',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['resetURL'] }));
});
