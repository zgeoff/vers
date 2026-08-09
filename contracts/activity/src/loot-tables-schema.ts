import * as z from 'zod';

const RarityDefSchema = z.object({
  id: z.string(),
  weight: z.number(),
  affixCountMin: z.number(),
  affixCountMax: z.number(),
});

const BaseDefSchema = z.object({
  id: z.string(),
  weight: z.number(),
});

const AffixDefSchema = z.object({
  id: z.string(),
  groupID: z.string(),
  weight: z.number(),
  valueMin: z.number(),
  valueMax: z.number(),
});

/**
 * A published loot content version: rarity, base, and affix table data pinned together.
 */
export const LootTablesSchema = z.object({
  contentVersion: z.string(),
  rarities: z.array(RarityDefSchema),
  bases: z.array(BaseDefSchema),
  affixes: z.array(AffixDefSchema),
});
