import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildSaltStream } from './build-salt-stream';
import { rollAffixesFromStream } from './roll-affixes-from-stream';
import type { LootTables, RolledAffix } from './types';

test('it redraws only values and keeps affix identities on a values-only roll', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    {
      baseID: 'placeholder-blade',
      rarityID: 'rare',
      affixes: [
        { affixID: 'flat-guard', groupID: 'guard', value: 999 },
        { affixID: 'flat-power', groupID: 'power', value: 999 },
      ],
    },
    { valuesOnly: true },
    stream,
  );

  expect(rolled.affixes.map((affix) => affix.affixID)).toStrictEqual(['flat-guard', 'flat-power']);

  expect(rolled.affixes).toSatisfyAll(
    (affix: RolledAffix) => affix.value >= 1 && affix.value <= 10,
  );
});

test('it keeps original values for protected groups on a values-only roll', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    {
      baseID: 'placeholder-blade',
      rarityID: 'rare',
      affixes: [
        { affixID: 'flat-guard', groupID: 'guard', value: 999 },
        { affixID: 'flat-power', groupID: 'power', value: 999 },
      ],
    },
    { valuesOnly: true, protectGroupIDs: ['guard'] },
    stream,
  );

  expect(rolled.affixes).toPartiallyContain({ affixID: 'flat-guard', value: 999 });
  expect(rolled.affixes).not.toPartiallyContain({ affixID: 'flat-power', value: 999 });
});

test('it rolls a forced affix without a pick draw and counts it toward the total', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'magic', affixes: [] },
    { count: 1, forceAffixIDs: ['pct-guard'] },
    stream,
  );

  expect(rolled.affixes).toHaveLength(1);
  expect(rolled.affixes[0]).toMatchObject({ affixID: 'pct-guard', groupID: 'guard' });
});

test('it draws the count from the rarity range when the constraint omits it', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    stream,
  );

  expect(rolled.affixes).toHaveLength(2);
});

test('it clamps the roll when the pool runs out of groups', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    { count: 5 },
    stream,
  );

  expect(rolled.affixes).toHaveLength(2);
});

test('it never repeats a group within one roll', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    { count: 2 },
    stream,
  );

  const groups = rolled.affixes.map((affix) => affix.groupID);

  expect(groups).toStrictEqual([...new Set(groups)]);
});

test('it excludes occupied groups from the picks when asked', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tables,
    {
      baseID: 'placeholder-blade',
      rarityID: 'rare',
      affixes: [{ affixID: 'flat-power', groupID: 'power', value: 4 }],
    },
    { count: 2, excludeOccupiedGroups: true },
    stream,
  );

  expect(rolled.affixes).toHaveLength(1);
  expect(rolled.affixes[0]).toMatchObject({ groupID: 'guard' });
});

test('it reproduces identical rolls from identical streams', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const first = buildSaltStream(hexToBytes('ab'.repeat(32)));
  const second = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolledFirst = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    first,
  );

  const rolledSecond = rollAffixesFromStream(
    tables,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    second,
  );

  expect(rolledFirst).toStrictEqual(rolledSecond);
});

test('it rejects a forced list larger than the affix count', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(() =>
    rollAffixesFromStream(
      tables,
      { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
      { count: 1, forceAffixIDs: ['flat-power', 'flat-guard'] },
      stream,
    ),
  ).toThrowWithMessage(Error, /forced affixes must fit inside the affix count/);
});

test('it rejects forced affixes sharing a group', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(() =>
    rollAffixesFromStream(
      tables,
      { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
      { count: 2, forceAffixIDs: ['flat-power', 'pct-power'] },
      stream,
    ),
  ).toThrowWithMessage(Error, /forced affixes must occupy distinct groups/);
});

test('it rejects a values-only roll combined with an identity-changing constraint', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(() =>
    rollAffixesFromStream(
      tables,
      { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
      { valuesOnly: true, count: 1 },
      stream,
    ),
  ).toThrowWithMessage(Error, /a values-only roll combines only with protected groups/);
});

test('it rejects a base rarity missing from the tables', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
      { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
    ],
    bases: [
      { id: 'placeholder-blade', weight: 60 },
      { id: 'placeholder-focus', weight: 40 },
    ],
    affixes: [
      { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
      { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  };

  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(() =>
    rollAffixesFromStream(
      tables,
      { baseID: 'placeholder-blade', rarityID: 'mythic', affixes: [] },
      {},
      stream,
    ),
  ).toThrowWithMessage(Error, /base rarity must exist in the tables: mythic/);
});
