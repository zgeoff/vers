import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function upsertActiveAvatar(
  db: Kysely<DB>,
  userID: string,
  avatarID: string,
): Promise<void> {
  await db
    .insertInto('activeAvatars')
    .values({ avatarId: avatarID, userId: userID })
    .onConflict((oc) =>
      oc.column('userId').doUpdateSet({ avatarId: avatarID, updatedAt: sql`now()` }),
    )
    .execute();
}
