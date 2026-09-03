import * as z from 'zod';

export const RewardItemAffixSchema = z.object({
  affixID: z.string(),
  groupID: z.string(),
  value: z.number(),
});

export type RewardItemAffix = z.infer<typeof RewardItemAffixSchema>;
