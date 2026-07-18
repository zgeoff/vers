import * as z from 'zod';

/**
 * An avatar's persisted policy for a failed attempt: `abort` stops the stream at the failure,
 * `retry` starts a fresh continuation from the same scope.
 */
export const ActivityFailureActionSchema = z.enum(['abort', 'retry']);

export type ActivityFailureAction = z.infer<typeof ActivityFailureActionSchema>;
