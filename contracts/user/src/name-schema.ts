import * as z from 'zod';

export const NameSchema = z
  .string({ error: 'Name is required' })
  .min(3, { error: 'Name is too short' })
  .max(40, { error: 'Name is too long' });
