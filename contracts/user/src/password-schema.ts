import * as z from 'zod';

export const PasswordSchema = z
  .string({ error: 'Password is required' })
  .min(8, { error: 'Password must be 8+ characters' })
  .max(100, { error: 'Password is too long' });
