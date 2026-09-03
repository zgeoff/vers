import * as z from 'zod';

export const ActivityStatusSchema = z.enum([
  'active',
  'stopped',
  'rejected',
  'capped',
  'quarantined',
  'parked',
]);

export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;
