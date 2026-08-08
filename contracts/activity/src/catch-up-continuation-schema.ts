import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';

/**
 * One step of an `advanceActivity` bulk catch-up: `checkpoints` is the full tail — from version 1
 * through a terminal checkpoint — appended onto whichever row is active when this entry is
 * processed (the request's own `activityID` for the first entry, otherwise the row the previous
 * entry minted). Once that append lands terminal, `id`/`startKey`/`buildSnapshot` mint the next
 * row, ready for the following entry's tail. `buildSnapshot` is the client's own
 * prediction of that mint's server-authored snapshot — a fast-fail cross-check hint, never trusted
 * as the stored value.
 */
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
