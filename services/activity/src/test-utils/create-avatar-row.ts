import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Avatars, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';

interface CreateAvatarRowData extends Partial<Insertable<Avatars>> {
  readonly userId: string;
}

/**
 * Inserts an avatar row owned by a given user via kysely — this service's fixtures need a real
 * avatar to hang an activity off, and don't own the avatar domain.
 */
export function createAvatarRow(
  db: Kysely<DB>,
  data: Readonly<CreateAvatarRowData>,
): Promise<Selectable<Avatars>> {
  return db
    .insertInto('avatars')
    .values({
      id: createId(),
      name: faker.string.alpha({ casing: 'lower', length: { max: 12, min: 6 } }),
      ...data,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
