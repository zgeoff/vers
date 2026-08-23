import * as z from 'zod';
import { CheckpointInvalidReasonSchema } from './checkpoint-invalid-reason-schema';

/**
 * Why `advanceActivity` refused a request: every checkpoint-batch reason, plus the reasons a mint
 * adds. Every member is permanent under any submission order, with one exception.
 *
 * `build-snapshot-mismatch` is order-sensitive. The predecessor's xp has not reached the server's
 * total yet, and the same request succeeds once it does.
 */
export const AdvanceCheckpointInvalidReasonSchema = z.enum([
  ...CheckpointInvalidReasonSchema.options,
  'build-snapshot-mismatch',
  'continuation-not-terminal',
  'start-hash-mismatch',
]);

export type AdvanceCheckpointInvalidReason = z.infer<typeof AdvanceCheckpointInvalidReasonSchema>;
