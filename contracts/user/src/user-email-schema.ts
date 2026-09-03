import * as z from 'zod';

export const UserEmailSchema = z
  .email({
    error: (issue) => (issue.input === undefined ? 'Email is required' : 'Email is invalid'),
  })
  .min(3, { error: 'Email is too short' })
  .max(100, { error: 'Email is too long' })
  .transform((value) => value.toLowerCase());
