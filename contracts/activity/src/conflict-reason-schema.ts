import * as z from 'zod';

export const ConflictReasonSchema = z.enum([
  'active-run-exists',
  'activity-id-taken',
  'stale-chain-head',
  'stale-head',
]);

export type ConflictReason = z.infer<typeof ConflictReasonSchema>;
