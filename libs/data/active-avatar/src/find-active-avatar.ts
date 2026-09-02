import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

export function findActiveAvatar(
  db: Kysely<DB>,
  userID: string,
): Promise<{ id: string; name: string } | undefined> {
  return db
    .selectFrom('activeAvatars')
    .innerJoin('avatars', 'avatars.id', 'activeAvatars.avatarId')
    .select(['avatars.id', 'avatars.name'])
    .where('activeAvatars.userId', '=', userID)
    .executeTakeFirst();
}
