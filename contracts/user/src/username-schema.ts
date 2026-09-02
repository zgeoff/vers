import * as z from 'zod';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export const UsernameSchema = z
  .string({ error: 'Username is required' })
  .min(USERNAME_MIN_LENGTH, { error: 'Username is too short' })
  .max(USERNAME_MAX_LENGTH, { error: 'Username is too long' })
  .regex(/^[a-zA-Z0-9_]+$/, {
    error: 'Username can only include letters, numbers, and underscores',
  })
  .transform((value) => value.toLowerCase());
