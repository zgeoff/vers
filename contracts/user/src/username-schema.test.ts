import { expect, test } from 'bun:test';
import { UsernameSchema } from './username-schema';

test('it lowercases a well-formed username', () => {
  expect(UsernameSchema.parse('Bobby_1')).toBe('bobby_1');
});

test('it rejects a username with disallowed characters', () => {
  const result = UsernameSchema.safeParse('bobby!');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
