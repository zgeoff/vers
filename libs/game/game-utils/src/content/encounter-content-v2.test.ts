import { expect, test } from 'bun:test';
import type { EncounterPoolEntry } from '../types';
import { encounterContentV2 } from './encounter-content-v2';

test('it keeps every pool weight a positive integer', () => {
  const weights = encounterContentV2.pools.flatMap((pool) =>
    pool.entries.map((entry) => entry.weight),
  );

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

test('it keeps every pool entry pointed at a known archetype', () => {
  const archetypeIDs = new Set(encounterContentV2.archetypes.map((archetype) => archetype.id));

  expect(encounterContentV2.pools.flatMap((pool) => pool.entries)).toSatisfyAll(
    (entry: EncounterPoolEntry) => archetypeIDs.has(entry.archetypeID),
  );
});

test('it keeps archetype ids unique', () => {
  const archetypeIDs = encounterContentV2.archetypes.map((archetype) => archetype.id);

  expect(archetypeIDs).toStrictEqual([...new Set(archetypeIDs)]);
});

test('it keeps pool ids unique', () => {
  const poolIDs = encounterContentV2.pools.map((pool) => pool.id);

  expect(poolIDs).toStrictEqual([...new Set(poolIDs)]);
});

test('it keeps the wave-count and wave-size tuning ranges ordered', () => {
  expect(encounterContentV2.tuning.waveCountMin).toBeLessThanOrEqual(
    encounterContentV2.tuning.waveCountMax,
  );

  expect(encounterContentV2.tuning.waveSizeMin).toBeLessThanOrEqual(
    encounterContentV2.tuning.waveSizeMax,
  );
});
