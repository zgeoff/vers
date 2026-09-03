import * as z from 'zod';
import { ActivityCheckpointSchema } from './activity-checkpoint-schema';

export const ReplaySegmentOutputSchema = z.object({
  checkpoints: z.array(ActivityCheckpointSchema),
  elapsed: z.number(),

  haltedOnDurationCap: z.boolean().optional(),
});

export type ReplaySegmentOutput = z.infer<typeof ReplaySegmentOutputSchema>;
