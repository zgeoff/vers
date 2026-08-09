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

test('it keeps a sealed scalar field it does not declare', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3, juiceSalt: 7 });

  expect(result.success).toBeTrue();
  expect(result.data).toStrictEqual({ difficulty: 3, juiceSalt: 7 });
});

test('it rejects a sealed field that is not a string or number', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3, modifiers: { fire: 2 } });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['modifiers'] }));
});
