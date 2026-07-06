import * as z from 'zod';
import { AvatarClassSchema } from './avatar-class-schema';

/** An avatar as returned to callers. */
export const AvatarDataSchema = z.object({
  class: AvatarClassSchema,
  createdAt: z.date(),
  id: z.string(),
  level: z.int(),
  name: z.string(),
  updatedAt: z.date(),
  userID: z.string(),
  xp: z.int(),
});

export type AvatarData = z.infer<typeof AvatarDataSchema>;
