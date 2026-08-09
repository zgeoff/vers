import * as z from 'zod';

/**
 * The server-resolved encounter params an activity freezes at start, sourced from its scope node
 * and folded into the start hash so a later content change can't retroactively alter an activity
 * already in flight. `poolID` is absent for content versions that predate sealed pool selection.
 * Any further sealed field a content version stamps is a string or number — the catchall keeps it
 * through a parse, because the start hash folds every stored field and a re-read node must carry
 * exactly what was stamped. Parsed nodes are readonly — frozen at runtime — so a stamped node is
 * never mutated after the start hash commits to it.
 */
export const EncounterNodeSchema = z
  .object({
    difficulty: z.number(),
    poolID: z.string().optional(),
  })
  .catchall(z.union([z.number(), z.string(), z.undefined()]))
  .readonly();

export type EncounterNode = z.infer<typeof EncounterNodeSchema>;
