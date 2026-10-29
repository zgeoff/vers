import type { ActivityChains, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createAvatarRow } from './create-avatar-row';
import { createMockChainRow } from './factories/create-mock-chain-row';
import { updateAvatarChainsReplayPending } from './update-avatar-chains-replay-pending';

export async function createChainRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<Insertable<ActivityChains>>> = {},
): Promise<Selectable<ActivityChains>> {
  let avatarId = overrides.avatarId;

  if (avatarId === undefined) {
    const avatar = await createAvatarRow(db);

    avatarId = avatar.id;
  }

  const inserted = await db
    .insertInto('activityChains')
    .values(createMockChainRow({ ...overrides, avatarId }))
    .returningAll()
    .executeTakeFirstOrThrow();

  await updateAvatarChainsReplayPending(db, avatarId);

  return db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', inserted.avatarId)
    .where('scopeType', '=', inserted.scopeType)
    .where('scopeId', '=', inserted.scopeId)
    .executeTakeFirstOrThrow();
}
