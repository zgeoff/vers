import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedActivity } from '../types';

export async function updateChainReplayPending(
  trx: Transaction<DB>,
  claimed: Readonly<ClaimedActivity>,
): Promise<void> {
  // An append in flight on the chain sets the flag only when it reads it unset, and it cannot see
  // this transaction's write until commit. Waiting on its row first lets the count below include
  // it; an append that starts later waits on this lock and sets the flag after the commit.
  await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', claimed.avatarID)
    .where('scopeType', '=', claimed.scopeType)
    .where('scopeId', '=', claimed.scopeID)
    .where('status', '=', 'active')
    .forShare()
    .execute();

  await trx
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
