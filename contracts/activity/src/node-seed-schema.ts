import * as z from 'zod';
import { EncounterNodeSchema } from './encounter-node-schema';

/**
 * A world-map node's revealed start inputs as the client's durable cache holds them, keyed by the
 * `[avatarID, nodeID]` pair it was cached under: the genesis seed the chain originated from, its
 * current head, and the encounter and content version a local start synthesizes a start hash from.
 */
export const NodeSeedSchema = z.object({
  avatarID: z.string(),
  contentVersion: z.string(),
  encounterNode: EncounterNodeSchema,
  genesisSeed: z.string(),
  head: z.object({
    chainIndex: z.number(),
    nextSeed: z.string(),
  }),
  nodeID: z.string(),
});

export type NodeSeed = z.infer<typeof NodeSeedSchema>;
