import { expect, test } from 'bun:test';
import { VerificationTypeSchema } from './verification-type-schema';

test('it accepts every declared verification type', () => {
  expect(VerificationTypeSchema.safeParse('2fa-setup').success).toBeTrue();
});

test('it rejects a type outside the enum', () => {
  const result = VerificationTypeSchema.safeParse('sms');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
