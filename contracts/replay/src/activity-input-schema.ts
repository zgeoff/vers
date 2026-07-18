import * as z from 'zod';
import { EncounterDefinitionSchema } from './encounter-definition-schema';

/**
 * Wire shape of the engine's `WorldMapEncounterActivityInput` — the only activity variant the
 * engine runs today. `type` stays a literal so a future variant is an additive union member.
 */
export const ActivityInputSchema = z.object({
  difficulty: z.number(),
  encounter: EncounterDefinitionSchema,
  failureAction: z.enum(['abort', 'retry']),
  id: z.string(),
  name: z.string(),
  seed: z.string(),
  type: z.literal('world_map_encounter'),
});

export type ActivityInput = z.infer<typeof ActivityInputSchema>;
