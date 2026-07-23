import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Persists the given avatar as the user's active selection: inserts a fresh `active_avatars` row,
 * or on conflict updates the existing row's avatar and `updatedAt`.
 */
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
