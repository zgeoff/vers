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
    weight: z.number().int().positive(),
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
    waveCountMin: z.number().int().positive(),
    waveCountMax: z.number().int().positive(),
    waveSizeMin: z.number().int().positive(),
    waveSizeMax: z.number().int().positive(),
    difficultyScalingFactor: z.number().positive(),
  })
  .readonly()
  .refine((tuning) => tuning.waveCountMin <= tuning.waveCountMax, {
    message: 'waveCountMin must not exceed waveCountMax',
    path: ['waveCountMax'],
  })
  .refine((tuning) => tuning.waveSizeMin <= tuning.waveSizeMax, {
    message: 'waveSizeMin must not exceed waveSizeMax',
    path: ['waveSizeMax'],
  });

/**
 * A published encounter content version: archetype, pool, and tuning data pinned together. Every
 * pool entry's `archetypeID` must name a member of `archetypes`, and archetype and pool ids are
 * unique — this schema gates publishing, so incoherent content fails here rather than at replay.
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
    const archetypeIDs = new Set<string>();

    value.archetypes.forEach((archetype, archetypeIndex) => {
      if (archetypeIDs.has(archetype.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate archetype id: ${archetype.id}`,
          path: ['archetypes', archetypeIndex, 'id'],
        });
      }

      archetypeIDs.add(archetype.id);
    });

    const poolIDs = new Set<string>();

    value.pools.forEach((pool, poolIndex) => {
      if (poolIDs.has(pool.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate pool id: ${pool.id}`,
          path: ['pools', poolIndex, 'id'],
        });
      }

      poolIDs.add(pool.id);

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
