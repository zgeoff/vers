import * as z from 'zod';

/**
 * One affix on a revealed reward item: the affix identity, the exclusivity group it rolled from,
 * and the rolled magnitude.
 */
export const RewardItemAffixSchema = z.object({
  affixID: z.string(),
  groupID: z.string(),
  value: z.number(),
});

export type RewardItemAffix = z.infer<typeof RewardItemAffixSchema>;
