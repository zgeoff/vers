import * as z from 'zod';

const ActivityRewardsSchema = z.object({ xp: z.number() });
const ActivityLevelUpSchema = z.object({ from: z.number(), to: z.number() });

const sharedCheckpointShape = {
  levelUp: ActivityLevelUpSchema.optional(),
  nextSeed: z.string(),
  rewards: ActivityRewardsSchema,
  time: z.number(),
};

/**
 * Wire shape of the engine's `ActivityCheckpoint` union: one segment of simulation output.
 * `started` alone carries `seed` — every other checkpoint's implicit seed is the prior
 * checkpoint's `nextSeed`.
 */
export const ActivityCheckpointSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...sharedCheckpointShape, seed: z.string(), type: z.literal('started') }),
  z.strictObject({ ...sharedCheckpointShape, type: z.literal('failed') }),
  z.strictObject({ ...sharedCheckpointShape, type: z.literal('completed') }),
  z.strictObject({ ...sharedCheckpointShape, type: z.literal('progress') }),
]);

export type ActivityCheckpoint = z.infer<typeof ActivityCheckpointSchema>;
