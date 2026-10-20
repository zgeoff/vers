import * as db from '../db';

export function findLiveActivityAvatar(userID: string): { id: string; name: string } | null {
  const avatars = db.avatarCollection.findMany((query) => query.where({ userID }));

  for (const avatar of avatars) {
    const live = db.activityCollection.findFirst((query) =>
      query.where({ avatarID: avatar.id, status: 'active' }),
    );

    if (live !== undefined) {
      return { id: avatar.id, name: avatar.name };
    }
  }

  return null;
}
