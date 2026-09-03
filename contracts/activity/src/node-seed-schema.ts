import * as z from 'zod';
import { EncounterNodeSchema } from './encounter-node-schema';

export const NodeSeedSchema = z
  .object({
    avatarID: z.string(),
    contentVersion: z.string(),
    encounterNode: EncounterNodeSchema,
    genesisSeed: z.string(),
    anchor: z
      .object({
        chainIndex: z.number(),
        nextSeed: z.string(),
      })
      .readonly(),
    nodeID: z.string(),
  })
  .readonly();

export type NodeSeed = z.infer<typeof NodeSeedSchema>;
