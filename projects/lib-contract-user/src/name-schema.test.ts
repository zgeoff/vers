import { expect, test } from 'vitest';
import { NameSchema } from './name-schema';

test('it accepts a name within the length bounds', () => {
  expect(NameSchema.safeParse('Bob').success).toBeTrue();
});

test('it rejects a name shorter than 3 characters', () => {
  expect(NameSchema.safeParse('Bo').success).toBeFalse();
});
