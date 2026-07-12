import * as z from 'zod';

/**
 * An avatar as returned to callers.
 */
export const AvatarDataSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
  level: z.int(),
  name: z.string(),
  updatedAt: z.date(),
  userID: z.string(),
  xp: z.int(),
});

export type AvatarData = z.infer<typeof AvatarDataSchema>;
