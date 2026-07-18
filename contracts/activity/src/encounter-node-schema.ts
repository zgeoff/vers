import * as z from 'zod';

/**
 * The server-resolved encounter params an activity freezes at start, sourced from its scope node
 * and folded into the start hash so a later content change can't retroactively alter an activity
 * already in flight.
 */
export const EncounterNodeSchema = z.object({ difficulty: z.number() });

export type EncounterNode = z.infer<typeof EncounterNodeSchema>;
