import * as z from 'zod';

/**
 * An activity's lifecycle state. The terminal verification outcomes are declared alongside the
 * operational statuses because adding an enum value later costs a migration. `parked` is an
 * operational hold — a replay job whose stamped sim version the registry doesn't know — never a
 * cheat signal. It does not block new activity starts; that check applies only to `quarantined`.
 */
export const ActivityStatusSchema = z.enum([
  'active',
  'stopped',
  'rejected',
  'capped',
  'quarantined',
  'parked',
]);

export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;
