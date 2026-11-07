import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface AvatarProgress {
  readonly level: number;
  readonly xp: number;
}

export async function readAvatarProgress(
  db: Kysely<DB>,
  avatarID: string,
): Promise<AvatarProgress | null> {
  const row = await db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', avatarID)
    .executeTakeFirst();

  return row ?? null;
}
