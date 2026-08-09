import { expect, test } from 'bun:test';
import { CONTENT_BY_VERSION } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { deriveWorldmapContent } from './derive-worldmap-content';

const scopeSecret = new Uint8Array(32).fill(0x0b);

const contentV2 = CONTENT_BY_VERSION['2'];

invariant(contentV2, 'content version 2 must be registered for this test to be meaningful');

test('it stamps no sealed fields for content version 1', () => {
  const result = deriveWorldmapContent('1', { coord: [3, -2], scopeSecret, userSeed: 0 });

  expect(result).toStrictEqual({});
});

test('it stamps a poolID drawn from the registered pool list for content version 2', () => {
  const result = deriveWorldmapContent('2', { coord: [3, -2], scopeSecret, userSeed: 0 });

  invariant(result.poolID !== undefined, 'content version 2 must stamp a poolID');

  const poolIDs = contentV2.pools.map((pool) => pool.id);

  expect(poolIDs).toContain(result.poolID);
});

test('it stamps deterministically for identical input', () => {
  const input = { coord: [3, -2], scopeSecret, userSeed: 0 } as const;

  expect(deriveWorldmapContent('2', input)).toStrictEqual(deriveWorldmapContent('2', input));
});

test('it selects across every registered pool over a spread of coordinates', () => {
  const poolIDs = new Set(
    Array.from(
      { length: 50 },
      (_, i) => deriveWorldmapContent('2', { coord: [i, -i], scopeSecret, userSeed: 0 }).poolID,
    ),
  );

  expect(poolIDs.size).toBe(contentV2.pools.length);
});

test('it rejects an unknown content version and names it', () => {
  expect(() =>
    deriveWorldmapContent('nope', { coord: [3, -2], scopeSecret, userSeed: 0 }),
  ).toThrowWithMessage(Error, /unknown content version: nope/);
});
