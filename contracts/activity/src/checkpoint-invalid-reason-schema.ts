import * as z from 'zod';

/**
 * Why the server refused a checkpoint batch. Every member is permanent for the batch that carried
 * it: no later arrival, retry, or reordering makes the same bytes valid, so a client narrowing on
 * one drops the batch rather than queueing it again.
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
