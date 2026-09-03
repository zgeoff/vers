import * as db from '@vers/mock-services/db';
import type { AvatarRowSchema } from '@vers/mock-services/db';
import type * as z from 'zod';

export async function createActiveAvatar(
  avatar: Readonly<Partial<z.input<typeof AvatarRowSchema>>> = {},
): Promise<z.output<typeof AvatarRowSchema>> {
  const created = await db.avatarCollection.create(avatar);

  await db.activeAvatarCollection.create({ avatarID: created.id, userID: created.userID });

  return created;
}
