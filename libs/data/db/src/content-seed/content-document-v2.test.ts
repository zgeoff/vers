import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from '@vers/contract-activity';
import { toAttacksPerSecond, toSpeedPerMille } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { contentDocumentV2 } from './content-document-v2';

test('it parses the seeded v2 content document', () => {
  expect(() => ContentDocumentSchema.parse(contentDocumentV2)).not.toThrow();
});

test('it keeps every v2 pool weight a positive integer', () => {
  const weights = contentDocumentV2.encounter.pools.flatMap((pool) =>
    pool.entries.map((entry) => entry.weight),
  );

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

test('it keeps v2 archetype ids unique', () => {
  const archetypeIDs = contentDocumentV2.encounter.archetypes.map((archetype) => archetype.id);

  expect(archetypeIDs).toStrictEqual([...new Set(archetypeIDs)]);
});

test('it converts every v2 archetype attack speed to an exact per-mille integer', () => {
  const speeds = contentDocumentV2.encounter.archetypes.map((archetype) =>
    toSpeedPerMille(archetype.attackSpeed),
  );

  expect(speeds).toStrictEqual([500, 700, 900]);
});

test('it converts every v2 archetype attack speed back to its authored decimal', () => {
  const authored = contentDocumentV2.encounter.archetypes.map((archetype) => archetype.attackSpeed);

  expect(authored.map((speed) => toAttacksPerSecond(toSpeedPerMille(speed)))).toStrictEqual(
    authored,
  );
});

test('it keeps v2 pool ids unique', () => {
  const poolIDs = contentDocumentV2.encounter.pools.map((pool) => pool.id);

  expect(poolIDs).toStrictEqual([...new Set(poolIDs)]);
});

test('it keeps the v2 wave-count and wave-size tuning ranges ordered', () => {
  expect(contentDocumentV2.encounter.tuning.waveCountMin).toBeLessThanOrEqual(
    contentDocumentV2.encounter.tuning.waveCountMax,
  );

  expect(contentDocumentV2.encounter.tuning.waveSizeMin).toBeLessThanOrEqual(
    contentDocumentV2.encounter.tuning.waveSizeMax,
  );
});

test('it keeps every v2 pool at an equal weighted-mean baseXP', () => {
  const meanXPByPool = contentDocumentV2.encounter.pools.map((pool) => {
    const totalWeight = pool.entries.reduce((sum, entry) => sum + entry.weight, 0);

    const weightedXP = pool.entries.reduce((sum, entry) => {
      const archetype = contentDocumentV2.encounter.archetypes.find(
        (candidate) => candidate.id === entry.archetypeID,
      );

      invariant(
        archetype,
        `pool "${pool.id}" references an unregistered archetype: ${entry.archetypeID}`,
      );

      return sum + archetype.baseXP * entry.weight;
    }, 0);

    return weightedXP / totalWeight;
  });

  expect(meanXPByPool).toSatisfyAll((mean: number) => mean === meanXPByPool[0]);
});

test('it keeps every v2 loot weight a positive integer', () => {
  const weights = [
    ...contentDocumentV2.loot.rarities.map((rarity) => rarity.weight),
    ...contentDocumentV2.loot.bases.map((base) => base.weight),
    ...contentDocumentV2.loot.affixes.map((affix) => affix.weight),
  ];

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

interface RarityCountRange {
  readonly affixCountMin: number;
  readonly affixCountMax: number;
}

test('it keeps every v2 rarity count range within the distinct group count', () => {
  const groupCount = new Set(contentDocumentV2.loot.affixes.map((affix) => affix.groupID)).size;

  expect(contentDocumentV2.loot.rarities).toSatisfyAll(
    (rarity: RarityCountRange) =>
      rarity.affixCountMin >= 0 &&
      rarity.affixCountMin <= rarity.affixCountMax &&
      rarity.affixCountMax <= groupCount,
  );
});

interface AffixValueRange {
  readonly valueMin: number;
  readonly valueMax: number;
}

test('it keeps every v2 affix value range ordered', () => {
  expect(contentDocumentV2.loot.affixes).toSatisfyAll(
    (affix: AffixValueRange) => affix.valueMin <= affix.valueMax,
  );
});

test('it keeps v2 loot ids unique within each table', () => {
  const rarityIDs = contentDocumentV2.loot.rarities.map((rarity) => rarity.id);
  const baseIDs = contentDocumentV2.loot.bases.map((base) => base.id);
  const affixIDs = contentDocumentV2.loot.affixes.map((affix) => affix.id);

  expect(rarityIDs).toStrictEqual([...new Set(rarityIDs)]);
  expect(baseIDs).toStrictEqual([...new Set(baseIDs)]);
  expect(affixIDs).toStrictEqual([...new Set(affixIDs)]);
});
