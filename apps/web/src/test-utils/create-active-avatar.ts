import * as db from '@vers/mock-services/db';
import type { AvatarRowSchema } from '@vers/mock-services/db';
import type * as z from 'zod';

/**
 * Creates an avatar row and marks it the owner's active selection, mirroring the create flow's
 * auto-select — tests that render as "the player's avatar" need both rows now that the active
 * avatar is a persisted choice, not the first row.
 */
export async function createActiveAvatar(
  avatar: Readonly<Partial<z.input<typeof AvatarRowSchema>>> = {},
): Promise<z.output<typeof AvatarRowSchema>> {
  const created = await db.avatarCollection.create(avatar);

  await db.activeAvatarCollection.create({ avatarID: created.id, userID: created.userID });

  return created;
}
