import { expect, test } from 'bun:test';
import { VerificationDataSchema } from './verification-data-schema';

test('it accepts a well-formed verification', () => {
  const result = VerificationDataSchema.safeParse({
    id: 'verification_1',
    target: 'person@example.com',
    type: 'change-email',
  });

  expect(result.success).toBeTrue();
});

test('it strips the TOTP secret instead of passing it through', () => {
  const parsed = VerificationDataSchema.parse({
    id: 'verification_1',
    secret: 'should-not-be-here',
    target: 'person@example.com',
    type: 'change-email',
  });

  expect('secret' in parsed).toBeFalse();
});
