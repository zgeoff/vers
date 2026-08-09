import * as z from 'zod';

const EncounterArchetypeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    baseLevel: z.number(),
    baseLife: z.number(),
    baseXP: z.number(),
    attackMin: z.number(),
    attackMax: z.number(),
    attackSpeed: z.number(),
  })
  .readonly();

const EncounterPoolEntrySchema = z
  .object({
    archetypeID: z.string(),
    weight: z.number(),
  })
  .readonly();

const EncounterPoolSchema = z
  .object({
    id: z.string(),
    entries: z.tuple([EncounterPoolEntrySchema], EncounterPoolEntrySchema).readonly(),
  })
  .readonly();

const EncounterTuningSchema = z
  .object({
    waveCountMin: z.number(),
    waveCountMax: z.number(),
    waveSizeMin: z.number(),
    waveSizeMax: z.number(),
    difficultyScalingFactor: z.number(),
  })
  .readonly();

/**
 * A published encounter content version: archetype, pool, and tuning data pinned together. Every
 * pool entry's `archetypeID` must name a member of `archetypes`.
 */
export const EncounterContentSchema = z
  .object({
    contentVersion: z.string(),
    archetypes: z.array(EncounterArchetypeSchema).readonly(),
    pools: z.tuple([EncounterPoolSchema], EncounterPoolSchema).readonly(),
    tuning: EncounterTuningSchema,
  })
  .readonly()
  .superRefine((value, ctx) => {
    const archetypeIDs = new Set(value.archetypes.map((archetype) => archetype.id));

    value.pools.forEach((pool, poolIndex) => {
      pool.entries.forEach((entry, entryIndex) => {
        if (!archetypeIDs.has(entry.archetypeID)) {
          ctx.addIssue({
            code: 'custom',
            message: `pool entry references an unregistered archetype: ${entry.archetypeID}`,
            path: ['pools', poolIndex, 'entries', entryIndex, 'archetypeID'],
          });
        }
      });
    });
  });
