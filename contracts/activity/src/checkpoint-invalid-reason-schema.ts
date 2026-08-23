import * as z from 'zod';

/**
 * Why the server refused a checkpoint batch. Every member is permanent: a retry, a later arrival,
 * or a different submission order never makes the refused batch valid. A client that narrows on the
 * reason drops the batch instead of queueing it again.
 */
export const CheckpointInvalidReasonSchema = z.enum([
  'broken-chain-link',
  'hash-mismatch',
  'invalid-reward-slots',
  'invalid-rewards',
  'non-contiguous-chain-index',
  'non-contiguous-versions',
  'non-integer-time',
  'terminal-not-last',
  'time-regression',
]);

export type CheckpointInvalidReason = z.infer<typeof CheckpointInvalidReasonSchema>;
