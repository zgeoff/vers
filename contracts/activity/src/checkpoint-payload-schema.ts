import * as z from 'zod';

/**
 * A checkpoint's payload: an open record so the simulation can carry whatever state it needs,
 * with the subset the hash chain commits to declared explicitly. Parsed payloads are readonly —
 * frozen at runtime — so every consumer sees the exact bytes the hash chain committed to.
 */
export const CheckpointPayloadSchema = z
  .looseObject({
    entropySource: z.string(),
    nextSeed: z.string(),
    seed: z.string(),
    time: z.number(),
    type: z.string(),
  })
  .readonly();

export type CheckpointPayload = z.infer<typeof CheckpointPayloadSchema>;
