import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

/**
 * A stored mock active-avatar selection: one row per user naming the avatar the account plays as,
 * mirroring the real service's `active_avatars` table.
 */
const ActiveAvatarRowSchema = z.object({
  avatarID: z.string().default(() => createId()),
  userID: z.string().default(() => createId()),
});

export const activeAvatarCollection = new Collection({ schema: ActiveAvatarRowSchema });
