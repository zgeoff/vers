import * as z from 'zod';
import { EnemyDataSchema } from './enemy-data-schema';

/**
 * Wire shape of the engine's `EncounterDefinition` — a fully resolved world map encounter's
 * ordered waves, each an ordered array of enemies.
 */
export const EncounterDefinitionSchema = z.object({
  waves: z.array(z.array(EnemyDataSchema)),
});

export type EncounterDefinition = z.infer<typeof EncounterDefinitionSchema>;
