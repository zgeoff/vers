import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Avatars, DB } from '@vers/db';
import { createTestUser } from '@vers/service-test-utils/bun';
import type { Insertable, Kysely, Selectable } from 'kysely';

export async function createAvatarRow(
  db: Kysely<DB>,
  data: Readonly<Partial<Insertable<Avatars>>> = {},
): Promise<Selectable<Avatars>> {
  let userId = data.userId;

  if (userId === undefined) {
    const created = await createTestUser(db);

    userId = created.user.id;
  }

  return db
    .insertInto('avatars')
    .values({
      id: createId(),
      name: faker.string.alpha({ casing: 'lower', length: { max: 12, min: 6 } }),
      seed: faker.number.int({ max: 2 ** 31 - 1, min: 0 }),
      ...data,
      userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
