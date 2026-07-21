import * as db from '../db';

/**
 * Writes the user's active-avatar selection, replacing any existing row, mirroring the real
 * service's keyed upsert.
 */
export async function upsertActiveAvatar(userID: string, avatarID: string): Promise<void> {
  const existing = db.activeAvatarCollection.findFirst((q) => q.where({ userID }));

  if (existing === undefined) {
    await db.activeAvatarCollection.create({ avatarID, userID });

    return;
  }

  await db.activeAvatarCollection.update(existing, {
    data(record) {
      record.avatarID = avatarID;
    },
  });
}
