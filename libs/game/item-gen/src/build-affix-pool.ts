import invariant from 'tiny-invariant';
import type { AffixConstraints, AffixDef, AffixPool } from './types';

/**
 * Applies a constraint set to an affix table in the canonical order — occupancy and protection
 * filters, then reweights (factor 0 removes; an id absent from the pool is a no-op), then a sort
 * by affix id — so equal inputs always yield an identical pool. Forced affixes bypass the filters;
 * only their existence in the table is asserted.
 */
export function buildAffixPool(
  affixes: ReadonlyArray<AffixDef>,
  occupiedGroupIDs: ReadonlySet<string>,
  constraints: Readonly<AffixConstraints>,
): AffixPool {
  const protectedGroupIDs = new Set(constraints.protectGroupIDs);

  const reweights = constraints.reweights ?? {};

  const entries = affixes
    .filter(
      (affix) =>
        !(constraints.excludeOccupiedGroups === true && occupiedGroupIDs.has(affix.groupID)),
    )
    .filter((affix) => !protectedGroupIDs.has(affix.groupID))
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
    .filter((affix) => affix.weight > 0)
    .toSorted((a, b) => (a.id < b.id ? -1 : 1));

  const forced = (constraints.forceAffixIDs ?? []).toSorted().map((affixID) => {
    const affix = affixes.find((candidate) => candidate.id === affixID);

    invariant(affix, `forced affix must exist in the tables: ${affixID}`);

    return affix;
  });

  return { entries, forced };
}
