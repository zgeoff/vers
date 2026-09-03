import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

const ActiveAvatarRowSchema = z.object({
  avatarID: z.string().default(() => createId()),
  userID: z.string().default(() => createId()),
});

export const activeAvatarCollection = new Collection({ schema: ActiveAvatarRowSchema });
