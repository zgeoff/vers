import { expect, test } from 'vitest';
import { VerificationTypeSchema } from './verification-type-schema';

test('it accepts every declared verification type', () => {
  expect(VerificationTypeSchema.safeParse('2fa-setup').success).toBeTrue();
});

test('it rejects a type outside the enum', () => {
  expect(VerificationTypeSchema.safeParse('sms').success).toBeFalse();
});
