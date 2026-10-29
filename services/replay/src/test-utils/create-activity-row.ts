import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createAvatarRow } from './create-avatar-row';
import { createMockActivityRow } from './factories/create-mock-activity-row';
import { updateAvatarChainsReplayPending } from './update-avatar-chains-replay-pending';

export async function createActivityRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<Insertable<Activities>>> = {},
): Promise<Selectable<Activities>> {
  let avatarId = overrides.avatarId;

  if (avatarId === undefined) {
    const avatar = await createAvatarRow(db);

    avatarId = avatar.id;
  }

  const row = await db
    .insertInto('activities')
    .values(createMockActivityRow({ ...overrides, avatarId }))
    .returningAll()
    .executeTakeFirstOrThrow();

  await updateAvatarChainsReplayPending(db, avatarId);

  return row;
}
