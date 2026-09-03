import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

export async function findLiveActivityAvatar(
  db: Kysely<DB>,
  userID: string,
): Promise<{ id: string; name: string } | null> {
  const row = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select(['avatars.id', 'avatars.name'])
    .where('avatars.userId', '=', userID)
    .where('activities.status', '=', 'active')
    .executeTakeFirst();

  return row ?? null;
}
