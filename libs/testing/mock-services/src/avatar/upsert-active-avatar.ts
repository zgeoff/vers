import * as db from '../db';

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
