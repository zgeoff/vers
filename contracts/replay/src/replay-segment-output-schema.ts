import * as z from 'zod';
import { ActivityCheckpointSchema } from './activity-checkpoint-schema';

/**
 * Wire output of the replay provider endpoint.
 */
export const ReplaySegmentOutputSchema = z.object({
  checkpoints: z.array(ActivityCheckpointSchema),
  elapsed: z.number(),
});

export type ReplaySegmentOutput = z.infer<typeof ReplaySegmentOutputSchema>;
