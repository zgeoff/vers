import * as z from 'zod';

/**
 * An activity's lifecycle state. Only `active` and `stopped` are reachable today; the terminal
 * verification outcomes are declared now because adding an enum value later costs a migration.
 */
export const ActivityStatusSchema = z.enum([
  'active',
  'stopped',
  'rejected',
  'capped',
  'quarantined',
]);

export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;
