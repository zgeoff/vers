import * as z from 'zod';

/**
 * The server-resolved encounter params an activity freezes at start, sourced from its scope node
 * and folded into the start hash so a later content change can't retroactively alter an activity
 * already in flight. `poolID` is absent for content versions that predate sealed pool selection.
 */
export const EncounterNodeSchema = z.object({
  difficulty: z.number(),
  poolID: z.string().optional(),
});

export type EncounterNode = z.infer<typeof EncounterNodeSchema>;
