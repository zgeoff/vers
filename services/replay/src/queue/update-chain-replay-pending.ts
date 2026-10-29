import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedActivity } from '../types';

export async function updateChainReplayPending(
  trx: Transaction<DB>,
  claimed: Readonly<ClaimedActivity>,
): Promise<void> {
  const active = trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', claimed.avatarID)
    .where('scopeType', '=', claimed.scopeType)
    .where('scopeId', '=', claimed.scopeID)
    .where('status', '=', 'active');

  const activeRows = await active.execute();

  // An append in flight sets the flag only when it reads it unset, so its row is locked here to
  // hold back a later append until commit. Waiting on an in-flight one would deadlock, since it
  // can wait on the avatar row settlement holds, so a row it holds keeps the flag set instead.
  const sharedRows = await active.forShare().skipLocked().execute();

  const isAppendInFlight = sharedRows.length < activeRows.length;

  await trx
    .updateTable('activityChains')
    .set((eb) => ({
      replayPending: isAppendInFlight
        ? eb.lit(true)
        : eb
            .case()
            .when(
              eb.exists(
                eb
                  .selectFrom('activities')
                  .select('activities.id')
                  .whereRef('activities.avatarId', '=', 'activityChains.avatarId')
                  .whereRef('activities.scopeType', '=', 'activityChains.scopeType')
                  .whereRef('activities.scopeId', '=', 'activityChains.scopeId')
                  .where((eb2) =>
                    eb2('activities.appendedHead', '>', eb2.ref('activities.verifiedHead')),
                  )
                  .where('activities.status', '!=', 'rejected'),
              ),
            )
            .then(true)
            .else(false)
            .end(),
    }))
    .where('avatarId', '=', claimed.avatarID)
    .where('scopeType', '=', claimed.scopeType)
    .where('scopeId', '=', claimed.scopeID)
    .execute();
}
