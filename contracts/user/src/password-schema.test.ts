import { expect, test } from 'bun:test';
import { PasswordSchema } from './password-schema';

test('it accepts a password of 8 or more characters', () => {
  expect(PasswordSchema.safeParse('password1').success).toBeTrue();
});

test('it rejects a password shorter than 8 characters', () => {
  const result = PasswordSchema.safeParse('short');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});

test('it rejects a password longer than 100 characters', () => {
  const result = PasswordSchema.safeParse('a'.repeat(101));

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
