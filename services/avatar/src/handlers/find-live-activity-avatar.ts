import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/**
 * Finds the avatar owning the user's live activity, or null when no run is live. At most one
 * activity per account is live by design, so the first match is the answer.
 */
export async function findLiveActivityAvatar(
  db: Kysely<DB>,
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const row = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select(['avatars.id', 'avatars.name'])
    .where('avatars.userId', '=', userId)
    .where('activities.status', '=', 'active')
    .executeTakeFirst();

  return row ?? null;
}
