import * as z from 'zod';
import { CheckpointInvalidReasonSchema } from './checkpoint-invalid-reason-schema';

/**
 * Why `advanceActivity` refused a request: every checkpoint-batch reason, plus the reasons a mint
 * adds. Every member is permanent under any submission order, with one exception.
 *
 * `build-snapshot-mismatch` is order-sensitive. The server counts a run toward the total only once
 * that run reaches a terminal status, so a caller whose earlier runs are still mid-flush predicts a
 * higher total than the server reads. The same request succeeds once those runs settle.
 */
export const AdvanceCheckpointInvalidReasonSchema = z.enum([
  ...CheckpointInvalidReasonSchema.options,
  'build-snapshot-mismatch',
  'continuation-not-terminal',
  'start-hash-mismatch',
]);

export type AdvanceCheckpointInvalidReason = z.infer<typeof AdvanceCheckpointInvalidReasonSchema>;
