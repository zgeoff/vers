import invariant from 'tiny-invariant';
import type { AffixConstraints, AffixDef, AffixPool } from './types';

export function buildAffixPool(
  affixes: ReadonlyArray<AffixDef>,
  occupiedGroupIDs: ReadonlySet<string>,
  constraints: Readonly<AffixConstraints>,
): AffixPool {
  const protectedGroupIDs = new Set(constraints.protectGroupIDs);

  const reweights = constraints.reweights ?? {};

  const entries = affixes

    // excludes occupied-group affixes when the constraint requests it
    .filter(
      (affix) =>
        !(constraints.excludeOccupiedGroups === true && occupiedGroupIDs.has(affix.groupID)),
    )

    // excludes protected groups
    .filter((affix) => !protectedGroupIDs.has(affix.groupID))

    // reweights: an id absent from the pool is a no-op
    .map((affix) => {
      const factor = Object.hasOwn(reweights, affix.id) ? reweights[affix.id] : undefined;

      if (factor === undefined) {
        return affix;
      }

      invariant(
        Number.isSafeInteger(factor) && factor >= 0,
        'reweight factors must be non-negative integers',
      );

      return {
        id: affix.id,
        groupID: affix.groupID,
        weight: affix.weight * factor,
        valueMin: affix.valueMin,
        valueMax: affix.valueMax,
      };
    })

    // factor 0 removes the affix from the pool
    .filter((affix) => affix.weight > 0)

    // sorts by affix id for a canonical, order-independent pool
    .toSorted((a, b) => (a.id < b.id ? -1 : 1));

  const forced = (constraints.forceAffixIDs ?? []).toSorted().map((affixID) => {
    const affix = affixes.find((candidate) => candidate.id === affixID);

    invariant(affix, `forced affix must exist in the tables: ${affixID}`);

    return affix;
  });

  return { entries, forced };
}
