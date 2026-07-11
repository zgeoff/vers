import * as z from 'zod';

/**
 * A checkpoint's payload: an open record so the simulation can carry whatever state it needs,
 * with the subset the hash chain commits to declared explicitly.
 */
export const CheckpointPayloadSchema = z.looseObject({
  nextSeed: z.string(),
  seed: z.string(),
  time: z.number(),
  type: z.string(),
});

export type CheckpointPayload = z.infer<typeof CheckpointPayloadSchema>;
