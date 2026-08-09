import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
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

  invariant(result.success, 'a sealed scalar field must parse');

  expect(result.data).toStrictEqual({ difficulty: 3, juiceSalt: 7 });
});

test('it rejects a sealed field that is not a string or number', () => {
  const result = EncounterNodeSchema.safeParse({ difficulty: 3, modifiers: { fire: 2 } });

  invariant(!result.success, 'a non-scalar sealed field must not parse');

  expect(result.error.issues).toPartiallyContain(expect.objectContaining({ path: ['modifiers'] }));
});

test('it freezes a parsed node', () => {
  expect(Object.isFrozen(EncounterNodeSchema.parse({ difficulty: 3 }))).toBeTrue();
});
