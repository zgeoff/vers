import { expect, test } from 'bun:test';
import { buildAffixPool } from './build-affix-pool';

test('it sorts the pool by affix id regardless of table order', () => {
  const pool = buildAffixPool(
    [
      { id: 'zeta', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 },
      { id: 'alpha', groupID: 'g2', weight: 1, valueMin: 1, valueMax: 2 },
      { id: 'mid', groupID: 'g3', weight: 1, valueMin: 1, valueMax: 2 },
    ],
    new Set(),
    {},
  );

  expect(pool.entries.map((affix) => affix.id)).toStrictEqual(['alpha', 'mid', 'zeta']);
});

test('it drops occupied groups only when the constraint asks for it', () => {
  const affixes = [
    { id: 'alpha', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 },
    { id: 'beta', groupID: 'g2', weight: 1, valueMin: 1, valueMax: 2 },
  ];

  const excluded = buildAffixPool(affixes, new Set(['g1']), { excludeOccupiedGroups: true });
  const kept = buildAffixPool(affixes, new Set(['g1']), {});

  expect(excluded.entries.map((affix) => affix.id)).toStrictEqual(['beta']);
  expect(kept.entries.map((affix) => affix.id)).toStrictEqual(['alpha', 'beta']);
});

test('it drops protected groups from the pool', () => {
  const pool = buildAffixPool(
    [
      { id: 'alpha', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 },
      { id: 'beta', groupID: 'g2', weight: 1, valueMin: 1, valueMax: 2 },
    ],
    new Set(),
    { protectGroupIDs: ['g2'] },
  );

  expect(pool.entries.map((affix) => affix.id)).toStrictEqual(['alpha']);
});

test('it multiplies weights by the reweight factor and removes factor-zero entries', () => {
  const pool = buildAffixPool(
    [
      { id: 'alpha', groupID: 'g1', weight: 3, valueMin: 1, valueMax: 2 },
      { id: 'beta', groupID: 'g2', weight: 2, valueMin: 1, valueMax: 2 },
      { id: 'gamma', groupID: 'g3', weight: 5, valueMin: 1, valueMax: 2 },
    ],
    new Set(),
    { reweights: { alpha: 4, beta: 0, missing: 7 } },
  );

  expect(pool.entries).toStrictEqual([
    { id: 'alpha', groupID: 'g1', weight: 12, valueMin: 1, valueMax: 2 },
    { id: 'gamma', groupID: 'g3', weight: 5, valueMin: 1, valueMax: 2 },
  ]);
});

test('it forces affixes past every filter in affix-id order', () => {
  const pool = buildAffixPool(
    [
      { id: 'zeta', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 },
      { id: 'alpha', groupID: 'g2', weight: 1, valueMin: 1, valueMax: 2 },
    ],
    new Set(['g1', 'g2']),
    { excludeOccupiedGroups: true, protectGroupIDs: ['g1'], forceAffixIDs: ['zeta', 'alpha'] },
  );

  expect(pool.entries).toStrictEqual([]);
  expect(pool.forced.map((affix) => affix.id)).toStrictEqual(['alpha', 'zeta']);
});

test('it rejects a forced affix missing from the tables', () => {
  expect(() =>
    buildAffixPool(
      [{ id: 'alpha', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 }],
      new Set(),
      { forceAffixIDs: ['ghost'] },
    ),
  ).toThrowWithMessage(Error, /forced affix must exist in the tables: ghost/);
});

test('it rejects a negative reweight factor', () => {
  expect(() =>
    buildAffixPool(
      [{ id: 'alpha', groupID: 'g1', weight: 1, valueMin: 1, valueMax: 2 }],
      new Set(),
      { reweights: { alpha: -1 } },
    ),
  ).toThrowWithMessage(Error, /reweight factors must be non-negative integers/);
});
