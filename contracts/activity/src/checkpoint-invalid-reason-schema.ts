import * as z from 'zod';

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
