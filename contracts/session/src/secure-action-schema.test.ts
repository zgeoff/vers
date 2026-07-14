import { expect, test } from 'bun:test';
import { SecureActionSchema } from './secure-action-schema';

test('it accepts every declared secure action', () => {
  expect(SecureActionSchema.safeParse('TwoFactorAuthSetup').success).toBeTrue();
});

test('it rejects an action outside the enum', () => {
  const result = SecureActionSchema.safeParse('DeleteAccount');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
