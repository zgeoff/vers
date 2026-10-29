import type { DB } from '@vers/db';
import { buildReplayReadyCondition } from '@vers/db';
import type { Kysely } from 'kysely';

export async function updateAvatarChainsReplayPending(
  db: Kysely<DB>,
  avatarID: string,
): Promise<void> {
  await db
    .updateTable('activityChains')
    .set((eb) => ({
      replayPending: eb
        .case()
        .when(
          eb.exists(
            eb
              .selectFrom('activities')
              .select('activities.id')
              .whereRef('activities.avatarId', '=', 'activityChains.avatarId')
              .whereRef('activities.scopeType', '=', 'activityChains.scopeType')
              .whereRef('activities.scopeId', '=', 'activityChains.scopeId')
              .where(buildReplayReadyCondition),
          ),
        )
        .then(true)
        .else(false)
        .end(),
    }))
    .where('avatarId', '=', avatarID)
    .execute();
}
