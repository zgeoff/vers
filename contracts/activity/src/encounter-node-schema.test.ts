import { expect, test } from 'bun:test';
import { EncounterNodeSchema } from './encounter-node-schema';

test('it accepts a well-formed encounter node', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3 });

  expect(result.success).toBeTrue();
});

test('it rejects a missing difficulty', () => {
  const result = EncounterNodeSchema.safeParse({});

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['difficulty'] }),
  );
});

test('it accepts an encounter node with a poolID', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3, poolID: 'brawler-den' });

  expect(result.success).toBeTrue();
});

test('it accepts an encounter node without a poolID', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3 });

  expect(result.success).toBeTrue();
});
