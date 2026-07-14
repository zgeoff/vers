import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildSaltStream } from './build-salt-stream';
import { rollAffixesFromStream } from './roll-affixes-from-stream';
import { tablesV1 } from './tables/tables-v1';
import type { RolledAffix } from './types';

test('it redraws only values and keeps affix identities on a values-only roll', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
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
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
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
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'magic', affixes: [] },
    { count: 1, forceAffixIDs: ['pct-guard'] },
    stream,
  );

  expect(rolled.affixes).toHaveLength(1);
  expect(rolled.affixes[0]).toMatchObject({ affixID: 'pct-guard', groupID: 'guard' });
});

test('it draws the count from the rarity range when the constraint omits it', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    stream,
  );

  expect(rolled.affixes).toHaveLength(2);
});

test('it clamps the roll when the pool runs out of groups', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    { count: 5 },
    stream,
  );

  expect(rolled.affixes).toHaveLength(2);
});

test('it never repeats a group within one roll', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    { count: 2 },
    stream,
  );

  const groups = rolled.affixes.map((affix) => affix.groupID);

  expect(groups).toStrictEqual([...new Set(groups)]);
});

test('it excludes occupied groups from the picks when asked', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolled = rollAffixesFromStream(
    tablesV1,
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
  const first = buildSaltStream(hexToBytes('ab'.repeat(32)));
  const second = buildSaltStream(hexToBytes('ab'.repeat(32)));

  const rolledFirst = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    first,
  );

  const rolledSecond = rollAffixesFromStream(
    tablesV1,
    { baseID: 'placeholder-blade', rarityID: 'rare', affixes: [] },
    {},
    second,
  );

  expect(rolledFirst).toStrictEqual(rolledSecond);
});

test('it rejects a base rarity missing from the tables', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(() =>
    rollAffixesFromStream(
      tablesV1,
      { baseID: 'placeholder-blade', rarityID: 'mythic', affixes: [] },
      {},
      stream,
    ),
  ).toThrowWithMessage(Error, /base rarity must exist in the tables: mythic/);
});
