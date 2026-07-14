import { expect, test } from 'bun:test';
import type { AffixDef, RarityDef } from '../types';
import { tablesV1 } from './tables-v1';

test('it keeps every weight a positive integer', () => {
  const weights = [
    ...tablesV1.rarities.map((rarity) => rarity.weight),
    ...tablesV1.bases.map((base) => base.weight),
    ...tablesV1.affixes.map((affix) => affix.weight),
  ];

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

test('it keeps every rarity count range within the distinct group count', () => {
  const groupCount = new Set(tablesV1.affixes.map((affix) => affix.groupID)).size;

  expect(tablesV1.rarities).toSatisfyAll(
    (rarity: RarityDef) =>
      rarity.affixCountMin >= 0 &&
      rarity.affixCountMin <= rarity.affixCountMax &&
      rarity.affixCountMax <= groupCount,
  );
});

test('it keeps every affix value range ordered', () => {
  expect(tablesV1.affixes).toSatisfyAll((affix: AffixDef) => affix.valueMin <= affix.valueMax);
});

test('it keeps ids unique within each table', () => {
  const rarityIDs = tablesV1.rarities.map((rarity) => rarity.id);
  const baseIDs = tablesV1.bases.map((base) => base.id);
  const affixIDs = tablesV1.affixes.map((affix) => affix.id);

  expect(rarityIDs).toStrictEqual([...new Set(rarityIDs)]);
  expect(baseIDs).toStrictEqual([...new Set(baseIDs)]);
  expect(affixIDs).toStrictEqual([...new Set(affixIDs)]);
});
