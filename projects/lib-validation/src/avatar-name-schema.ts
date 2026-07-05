import { z } from 'zod';

export const AvatarNameSchema = z
  .string()
  .min(3, 'Name must be at least 3 characters')
  .max(16, 'Name must be less than 16 characters')
  .regex(/^[a-zA-Z]+$/, 'Name must be alphabetic with no spaces or special characters');
