import * as z from 'zod';

/**
 * One rolled-reward slot earned within a checkpoint: `ordinal` is 0-based within the checkpoint's
 * own slot list, in canonical kill order — not a running total across the activity.
 */
export const RewardSlotSchema = z.object({
  context: z.object({ nodeTier: z.int().min(1) }),
  ordinal: z.int().min(0),
});

export type RewardSlot = z.infer<typeof RewardSlotSchema>;
