import * as z from 'zod';
import { EnemyDataSchema } from './enemy-data-schema';

export const EncounterDefinitionSchema = z.object({
  waves: z.array(z.array(EnemyDataSchema)),
});

export type EncounterDefinition = z.infer<typeof EncounterDefinitionSchema>;
