import * as z from 'zod';
import { ActivityCheckpointSchema } from './activity-checkpoint-schema';

/**
 * Wire output of the replay provider endpoint.
 */
export const ReplaySegmentOutputSchema = z.object({
  checkpoints: z.array(ActivityCheckpointSchema),
  elapsed: z.number(),

  /**
   * Set when the provider's engine exhausted `duration` before reaching `expectedCheckpointCount`
   * — an operational bound trip for the dispatcher to park on, never divergence. Absent (treated
   * as `false`) from a provider frozen before the field existed.
   */
  haltedOnDurationCap: z.boolean().optional(),
});

export type ReplaySegmentOutput = z.infer<typeof ReplaySegmentOutputSchema>;
