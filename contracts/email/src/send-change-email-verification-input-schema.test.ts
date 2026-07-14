import { expect, test } from 'bun:test';
import { SendChangeEmailVerificationInputSchema } from './send-change-email-verification-input-schema';

test('it accepts a well-formed change-email verification input', () => {
  const result = SendChangeEmailVerificationInputSchema.safeParse({
    newEmail: 'new@example.com',
    to: 'old@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify-email',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a newEmail that is not a valid address', () => {
  const result = SendChangeEmailVerificationInputSchema.safeParse({
    newEmail: 'not-an-email',
    to: 'old@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify-email',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['newEmail'] }));
});
