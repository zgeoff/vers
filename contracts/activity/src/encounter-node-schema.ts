import * as z from 'zod';

export const EncounterNodeSchema = z
  .object({
    difficulty: z.number(),
    poolID: z.string().optional(),
  })
  .catchall(z.union([z.number(), z.string(), z.undefined()]))
  .readonly();

export type EncounterNode = z.infer<typeof EncounterNodeSchema>;
