import type { Avatars, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockAvatar } from '../factories/create-mock-avatar';

interface CreateAvatarRowData extends Partial<Insertable<Avatars>> {
  readonly userId: string;
}

export function createAvatarRow(
  db: Kysely<DB>,
  data: Readonly<CreateAvatarRowData>,
): Promise<Selectable<Avatars>> {
  const row = createMockAvatar(data);

  return db.insertInto('avatars').values(row).returningAll().executeTakeFirstOrThrow();
}
