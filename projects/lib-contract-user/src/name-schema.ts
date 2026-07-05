import * as z from 'zod';

/** A user's display name. */
export const NameSchema = z
  .string({ error: 'Name is required' })
  .min(3, { error: 'Name is too short' })
  .max(40, { error: 'Name is too long' });
