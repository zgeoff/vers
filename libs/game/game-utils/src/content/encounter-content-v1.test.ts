import { expect, test } from 'bun:test';
import type { EncounterPoolEntry } from '../types';
import { encounterContentV1 } from './encounter-content-v1';

test('it keeps every pool weight a positive integer', () => {
  const weights = encounterContentV1.pools.flatMap((pool) =>
    pool.entries.map((entry) => entry.weight),
  );

  expect(weights).toSatisfyAll((weight: number) => Number.isInteger(weight) && weight >= 1);
});

test('it keeps every pool entry pointed at a known archetype', () => {
  const archetypeIDs = new Set(encounterContentV1.archetypes.map((archetype) => archetype.id));

  expect(encounterContentV1.pools.flatMap((pool) => pool.entries)).toSatisfyAll(
    (entry: EncounterPoolEntry) => archetypeIDs.has(entry.archetypeID),
  );
});

test('it keeps archetype ids unique', () => {
  const archetypeIDs = encounterContentV1.archetypes.map((archetype) => archetype.id);

  expect(archetypeIDs).toStrictEqual([...new Set(archetypeIDs)]);
});

test('it keeps the wave-count and wave-size tuning ranges ordered', () => {
  expect(encounterContentV1.tuning.waveCountMin).toBeLessThanOrEqual(
    encounterContentV1.tuning.waveCountMax,
  );

  expect(encounterContentV1.tuning.waveSizeMin).toBeLessThanOrEqual(
    encounterContentV1.tuning.waveSizeMax,
  );
});
