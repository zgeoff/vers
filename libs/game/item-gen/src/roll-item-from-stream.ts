import type { RollStream } from '@vers/roll-crypto';
import invariant from 'tiny-invariant';
import { rollAffixesFromStream } from './roll-affixes-from-stream';
import type { LootTables, RolledItem, SlotContext } from './types';

/**
 * Rolls a complete item in the canonical draw order — rarity pick, base pick, affix-count range
 * draw, then the shared affix path with that fixed count — so there is exactly one affix draw
 * sequence across dropping and crafting. Context selects tables; the stream decides outcomes.
 */
export function rollItemFromStream(
  tables: Readonly<LootTables>,
  context: Readonly<SlotContext>,
  stream: RollStream,
): RolledItem {
  invariant(
    Number.isSafeInteger(context.nodeTier) && context.nodeTier >= 0,
    'nodeTier must be a non-negative integer',
  );

  const rarity = stream.pickWeighted(
    tables.rarities.map((candidate) => ({ value: candidate, weight: candidate.weight })),
  );

  const base = stream.pickWeighted(
    tables.bases.map((candidate) => ({ value: candidate, weight: candidate.weight })),
  );

  const count = stream.rollRange(rarity.affixCountMin, rarity.affixCountMax);

  const rolled = rollAffixesFromStream(
    tables,
    { affixes: [], baseID: base.id, rarityID: rarity.id },
    { count },
    stream,
  );

  return {
    affixes: rolled.affixes,
    baseID: base.id,
    contentVersion: tables.contentVersion,
    rarityID: rarity.id,
  };
}
