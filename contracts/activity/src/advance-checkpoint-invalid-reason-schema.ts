import * as z from 'zod';
import { CheckpointInvalidReasonSchema } from './checkpoint-invalid-reason-schema';

/**
 * Why `advanceActivity` refused a request: every batch reason, plus the three the offline-first
 * path adds. `build-snapshot-mismatch` is the one member that is order-sensitive — the predecessor's
 * xp is not in the server's total yet, and the same request succeeds once it lands. The rest are
 * permanent under any order.
 */
export const AdvanceCheckpointInvalidReasonSchema = z.enum([
  ...CheckpointInvalidReasonSchema.options,
  'build-snapshot-mismatch',
  'continuation-not-terminal',
  'start-hash-mismatch',
]);

export type AdvanceCheckpointInvalidReason = z.infer<typeof AdvanceCheckpointInvalidReasonSchema>;
