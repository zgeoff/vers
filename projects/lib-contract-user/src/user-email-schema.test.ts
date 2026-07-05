import { expect, test } from 'vitest';
import { UserEmailSchema } from './user-email-schema';

test('it lowercases a well-formed email', () => {
  expect(UserEmailSchema.parse('Person@Example.com')).toBe('person@example.com');
});

test('it rejects a malformed email', () => {
  expect(UserEmailSchema.safeParse('not-an-email').success).toBeFalse();
});
