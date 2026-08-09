import { expect, test } from 'bun:test';
import type { AffixDef, RarityDef } from '../types';
import { tablesV2 } from './tables-v2';

test('it keeps every weight a positive integer', () => {
  const weights = [
    ...tablesV2.rarities.map((rarity) => rarity.weight),
    ...tablesV2.bases.map((base) => base.weight),
    ...tablesV2.affixes.map((affix) => affix.weight),
  ];

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

test('it keeps every rarity count range within the distinct group count', () => {
  const groupCount = new Set(tablesV2.affixes.map((affix) => affix.groupID)).size;

  expect(tablesV2.rarities).toSatisfyAll(
    (rarity: RarityDef) =>
      rarity.affixCountMin >= 0 &&
      rarity.affixCountMin <= rarity.affixCountMax &&
      rarity.affixCountMax <= groupCount,
  );
});

test('it keeps every affix value range ordered', () => {
  expect(tablesV2.affixes).toSatisfyAll((affix: AffixDef) => affix.valueMin <= affix.valueMax);
});

test('it keeps ids unique within each table', () => {
  const rarityIDs = tablesV2.rarities.map((rarity) => rarity.id);
  const baseIDs = tablesV2.bases.map((base) => base.id);
  const affixIDs = tablesV2.affixes.map((affix) => affix.id);

  expect(rarityIDs).toStrictEqual([...new Set(rarityIDs)]);
  expect(baseIDs).toStrictEqual([...new Set(baseIDs)]);
  expect(affixIDs).toStrictEqual([...new Set(affixIDs)]);
});
