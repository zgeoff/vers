import * as z from 'zod';

const RarityDefSchema = z
  .object({
    id: z.string(),
    weight: z.number().int().positive(),
    affixCountMin: z.number().int().nonnegative(),
    affixCountMax: z.number().int().nonnegative(),
  })
  .readonly()
  .refine((rarity) => rarity.affixCountMin <= rarity.affixCountMax, {
    message: 'affixCountMin must not exceed affixCountMax',
    path: ['affixCountMax'],
  });

const BaseDefSchema = z
  .object({
    id: z.string(),
    weight: z.number().int().positive(),
  })
  .readonly();

const AffixDefSchema = z
  .object({
    id: z.string(),
    groupID: z.string(),
    weight: z.number().int().positive(),
    valueMin: z.number(),
    valueMax: z.number(),
  })
  .readonly()
  .refine((affix) => affix.valueMin <= affix.valueMax, {
    message: 'valueMin must not exceed valueMax',
    path: ['valueMax'],
  });

/**
 * A published loot content version: rarity, base, and affix table data pinned together. Every
 * table is nonempty with unique ids — this schema gates publishing, so incoherent content fails
 * here rather than at replay.
 */
export const LootTablesSchema = z
  .object({
    contentVersion: z.string(),
    rarities: z.tuple([RarityDefSchema], RarityDefSchema).readonly(),
    bases: z.tuple([BaseDefSchema], BaseDefSchema).readonly(),
    affixes: z.tuple([AffixDefSchema], AffixDefSchema).readonly(),
  })
  .readonly()
  .superRefine((value, ctx) => {
    const rarityIDs = new Set<string>();

    value.rarities.forEach((rarity, rarityIndex) => {
      if (rarityIDs.has(rarity.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate rarity id: ${rarity.id}`,
          path: ['rarities', rarityIndex, 'id'],
        });
      }

      rarityIDs.add(rarity.id);
    });

    const baseIDs = new Set<string>();

    value.bases.forEach((base, baseIndex) => {
      if (baseIDs.has(base.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate base id: ${base.id}`,
          path: ['bases', baseIndex, 'id'],
        });
      }

      baseIDs.add(base.id);
    });

    const affixIDs = new Set<string>();

    value.affixes.forEach((affix, affixIndex) => {
      if (affixIDs.has(affix.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate affix id: ${affix.id}`,
          path: ['affixes', affixIndex, 'id'],
        });
      }

      affixIDs.add(affix.id);
    });
  });
