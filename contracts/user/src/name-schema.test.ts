import { expect, test } from 'bun:test';
import { NameSchema } from './name-schema';

test('it accepts a name within the length bounds', () => {
  expect(NameSchema.safeParse('Bob').success).toBeTrue();
});

test('it rejects a name shorter than 3 characters', () => {
  const result = NameSchema.safeParse('Bo');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
