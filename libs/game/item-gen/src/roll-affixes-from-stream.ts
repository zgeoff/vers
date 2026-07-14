import invariant from 'tiny-invariant';
import { buildAffixPool } from './build-affix-pool';
import type {
  AffixConstraints,
  AffixDef,
  ItemState,
  LootTables,
  RollStream,
  RolledAffix,
  RolledAffixes,
} from './types';

/**
 * Rolls affixes onto an existing base under a constraint set — the crafting entry point. The draw
 * sequence is frozen per content version: a values-only roll redraws each existing affix's value
 * in affix-id order; otherwise the count comes from `constraints.count` or one range draw over the
 * base rarity's count range, forced affixes consume one value draw each in affix-id order, and
 * every remaining pick is one weighted draw over the pool plus one value draw, with the picked
 * affix's whole group removed before the next pick. An exhausted pool clamps the roll — returning
 * fewer affixes keeps every shipped content version resolvable. Malformed constraints throw
 * before any draw: forced affixes must occupy distinct groups and fit inside the count, and a
 * values-only roll combines with protected groups alone — an action definition that breaks either
 * is a content bug, never a rollable input.
 */
export function rollAffixesFromStream(
  tables: Readonly<LootTables>,
  base: Readonly<ItemState>,
  constraints: Readonly<AffixConstraints>,
  stream: RollStream,
): RolledAffixes {
  if (constraints.valuesOnly === true) {
    invariant(
      constraints.count === undefined &&
        constraints.forceAffixIDs === undefined &&
        constraints.reweights === undefined &&
        constraints.excludeOccupiedGroups === undefined,
      'a values-only roll combines only with protected groups',
    );

    return rollValues(tables, base, constraints, stream);
  }

  const rarity = tables.rarities.find((candidate) => candidate.id === base.rarityID);

  invariant(rarity, `base rarity must exist in the tables: ${base.rarityID}`);

  const count = constraints.count ?? stream.rollRange(rarity.affixCountMin, rarity.affixCountMax);

  invariant(Number.isSafeInteger(count) && count >= 0, 'count must be a non-negative integer');

  const occupiedGroupIDs = new Set(base.affixes.map((affix) => affix.groupID));

  const pool = buildAffixPool(tables.affixes, occupiedGroupIDs, constraints);

  invariant(
    new Set(pool.forced.map((forced) => forced.groupID)).size === pool.forced.length,
    'forced affixes must occupy distinct groups',
  );

  invariant(pool.forced.length <= count, 'forced affixes must fit inside the affix count');

  const affixes: Array<RolledAffix> = [];

  for (const forced of pool.forced) {
    affixes.push(rollValue(forced, stream));
  }

  let entries = pool.entries.filter(
    (affix) => !pool.forced.some((forced) => forced.groupID === affix.groupID),
  );

  for (let pick = pool.forced.length; pick < count && entries.length > 0; pick += 1) {
    const picked = stream.pickWeighted(
      entries.map((affix) => ({ value: affix, weight: affix.weight })),
    );

    affixes.push(rollValue(picked, stream));

    entries = entries.filter((affix) => affix.groupID !== picked.groupID);
  }

  return { affixes };
}

function rollValues(
  tables: Readonly<LootTables>,
  base: Readonly<ItemState>,
  constraints: Readonly<AffixConstraints>,
  stream: RollStream,
): RolledAffixes {
  const protectedGroupIDs = new Set(constraints.protectGroupIDs);

  const sorted = base.affixes.toSorted((a, b) => (a.affixID < b.affixID ? -1 : 1));

  const affixes = sorted.map((existing) => {
    if (protectedGroupIDs.has(existing.groupID)) {
      return existing;
    }

    const affix = tables.affixes.find((candidate) => candidate.id === existing.affixID);

    invariant(affix, `existing affix must exist in the tables: ${existing.affixID}`);

    return rollValue(affix, stream);
  });

  return { affixes };
}

function rollValue(affix: Readonly<AffixDef>, stream: RollStream): RolledAffix {
  return {
    affixID: affix.id,
    groupID: affix.groupID,
    value: stream.rollRange(affix.valueMin, affix.valueMax),
  };
}
