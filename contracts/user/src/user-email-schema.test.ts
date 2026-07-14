import { expect, test } from 'bun:test';
import { UserEmailSchema } from './user-email-schema';

test('it lowercases a well-formed email', () => {
  expect(UserEmailSchema.parse('Person@Example.com')).toBe('person@example.com');
});

test('it rejects a malformed email', () => {
  const result = UserEmailSchema.safeParse('not-an-email');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});

test('it reports a missing email as required', () => {
  const result = UserEmailSchema.safeParse(undefined);

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
  expect(result.error?.issues.map((issue) => issue.message)).toStrictEqual(['Email is required']);
});

test('it reports a malformed email as invalid', () => {
  const result = UserEmailSchema.safeParse('not-an-email');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
  expect(result.error?.issues.map((issue) => issue.message)).toStrictEqual(['Email is invalid']);
});
