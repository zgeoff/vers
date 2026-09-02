import * as z from 'zod';

export const RewardSlotSchema = z.object({
  context: z.object({ nodeTier: z.int().min(1) }),
  ordinal: z.int().min(0),
});

export type RewardSlot = z.infer<typeof RewardSlotSchema>;
