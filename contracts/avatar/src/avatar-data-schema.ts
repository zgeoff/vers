import * as z from 'zod';
import { AvatarModeSchema } from './avatar-mode-schema';

/**
 * An avatar as returned to callers.
 */
export const AvatarDataSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
  level: z.int(),
  mode: AvatarModeSchema,
  name: z.string(),
  updatedAt: z.date(),
  userID: z.string(),
  xp: z.int(),
});

export type AvatarData = z.infer<typeof AvatarDataSchema>;
