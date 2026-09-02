import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';

export const CatchUpContinuationSchema = z.object({
  buildSnapshot: BuildSnapshotSchema,
  checkpoints: z
    .array(CheckpointBatchEntrySchema)
    .min(1)
    .max(MAX_CATCH_UP_BATCH_CHECKPOINTS)
    .readonly(),
  id: z.string(),
  startKey: z.string().max(128),
});

export type CatchUpContinuation = z.infer<typeof CatchUpContinuationSchema>;
