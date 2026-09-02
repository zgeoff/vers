import type { ActivityChains, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createAvatarRow } from './create-avatar-row';
import { createMockChainRow } from './factories/create-mock-chain-row';

export async function createChainRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<Insertable<ActivityChains>>> = {},
): Promise<Selectable<ActivityChains>> {
  let avatarId = overrides.avatarId;

  if (avatarId === undefined) {
    const avatar = await createAvatarRow(db);

    avatarId = avatar.id;
  }

  return db
    .insertInto('activityChains')
    .values(createMockChainRow({ ...overrides, avatarId }))
    .returningAll()
    .executeTakeFirstOrThrow();
}
