import * as z from 'zod';

/** A user's email address; normalized to lowercase since users can type it in any case. */
export const UserEmailSchema = z
  .email({ error: 'Email is invalid' })
  .min(3, { error: 'Email is too short' })
  .max(100, { error: 'Email is too long' })
  .transform((value) => value.toLowerCase());
