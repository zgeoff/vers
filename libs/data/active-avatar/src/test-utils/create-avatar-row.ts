import type { Avatars, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockAvatarRow } from './factories/create-mock-avatar-row';

interface CreateAvatarRowData extends Partial<Insertable<Avatars>> {
  readonly userId: string;
}

/**
 * Seeds an avatar owned by the given user — the live-run and selection queries under test need a
 * real owning avatar to query against.
 */
export function createAvatarRow(
  db: Kysely<DB>,
  data: Readonly<CreateAvatarRowData>,
): Promise<Selectable<Avatars>> {
  const row = createMockAvatarRow(data);

  return db.insertInto('avatars').values(row).returningAll().executeTakeFirstOrThrow();
}
