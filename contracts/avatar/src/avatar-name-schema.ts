import * as z from 'zod';

export const AvatarNameSchema = z
  .string({ error: 'Name is required' })
  .min(3, { error: 'Name must be at least 3 characters' })
  .max(16, { error: 'Name must be less than 16 characters' })
  .regex(/^[a-zA-Z]+$/, {
    error: 'Name must be alphabetic with no spaces or special characters',
  });
