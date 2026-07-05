import { expect, test } from 'vitest';
import { SecureActionSchema } from './secure-action-schema';

test('it accepts every declared secure action', () => {
  expect(SecureActionSchema.safeParse('TwoFactorAuthSetup').success).toBeTrue();
});

test('it rejects an action outside the enum', () => {
  expect(SecureActionSchema.safeParse('DeleteAccount').success).toBeFalse();
});
