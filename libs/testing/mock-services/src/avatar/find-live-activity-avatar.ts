import * as db from '../db';

/**
 * Finds the avatar owning the user's live mock activity, or null when no run is live, mirroring
 * the real service's guard query.
 */
export function findLiveActivityAvatar(userID: string): { id: string; name: string } | null {
  const avatars = db.avatarCollection.findMany((q) => q.where({ userID }));

  for (const avatar of avatars) {
    const live = db.activityCollection.findFirst((q) =>
      q.where({ avatarID: avatar.id, status: 'active' }),
    );

    if (live !== undefined) {
      return { id: avatar.id, name: avatar.name };
    }
  }

  return null;
}
