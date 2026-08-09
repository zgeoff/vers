import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import type { EncounterArchetype, EncounterPool } from '../types';
import { CONTENT_BY_VERSION } from './content-by-version';

function buildWeightedMeanBaseXP(
  pool: Readonly<EncounterPool>,
  archetypes: ReadonlyArray<EncounterArchetype>,
): number {
  const totalWeight = pool.entries.reduce((sum, entry) => sum + entry.weight, 0);

  const weightedXP = pool.entries.reduce((sum, entry) => {
    const archetype = archetypes.find((candidate) => candidate.id === entry.archetypeID);

    invariant(
      archetype,
      `pool "${pool.id}" references an unregistered archetype: ${entry.archetypeID}`,
    );

    return sum + archetype.baseXP * entry.weight;
  }, 0);

  return weightedXP / totalWeight;
}

test('every registered content version keeps every pool at an equal weighted-mean baseXP', () => {
  for (const content of Object.values(CONTENT_BY_VERSION)) {
    const meanXPByPool = content.pools.map((pool) =>
      buildWeightedMeanBaseXP(pool, content.archetypes),
    );

    expect(meanXPByPool).toSatisfyAll((mean: number) => mean === meanXPByPool[0]);
  }
});
