import type { DB } from '@vers/db';
import { buildReplayReadyCondition } from '@vers/db';
import type { Kysely } from 'kysely';

interface ReplayPendingRepair {
  readonly cleared: number;
  readonly flagged: number;
}

// Each statement locks only the chain rows no other transaction holds, because a claim holds its
// chain for a whole replay and a request-path writer can hold one while it waits on a row the
// caller holds; a chain skipped here is repaired by the pass at the start of the next drain.
export async function updateReplayPendingChains(
  db: Kysely<DB>,
  avatarID: string | undefined,
): Promise<ReplayPendingRepair> {
  const flagged = await db
    .updateTable('activityChains')
    .set({ replayPending: true })
    .where((eb) =>
      eb(
        eb.refTuple('avatarId', 'scopeType', 'scopeId'),
        'in',
        eb
          .selectFrom('activities')
          .innerJoin('activityChains as chain', (join) =>
            join
              .onRef('chain.avatarId', '=', 'activities.avatarId')
              .onRef('chain.scopeType', '=', 'activities.scopeType')
              .onRef('chain.scopeId', '=', 'activities.scopeId'),
          )
          .select(['chain.avatarId', 'chain.scopeType', 'chain.scopeId'])
          .where('chain.replayPending', '=', false)
          .where(buildReplayReadyCondition)
          .where((eb2) =>
            avatarID === undefined ? eb2.lit(true) : eb2('chain.avatarId', '=', avatarID),
          )
          .forNoKeyUpdate('chain')
          .skipLocked()
          .$asTuple('avatarId', 'scopeType', 'scopeId'),
      ),
    )
    .executeTakeFirst();

  const cleared = await db
    .updateTable('activityChains')
    .set({ replayPending: false })
    .where((eb) =>
      eb(
        eb.refTuple('avatarId', 'scopeType', 'scopeId'),
        'in',
        eb
          .selectFrom('activityChains as chain')
          .select(['chain.avatarId', 'chain.scopeType', 'chain.scopeId'])
          .where('chain.replayPending', '=', true)
          .where((eb2) =>
            eb2.not(
              eb2.exists(
                eb2
                  .selectFrom('activities')
                  .select('activities.id')
                  .whereRef('activities.avatarId', '=', 'chain.avatarId')
                  .whereRef('activities.scopeType', '=', 'chain.scopeType')
                  .whereRef('activities.scopeId', '=', 'chain.scopeId')
                  .where(buildReplayReadyCondition),
              ),
            ),
          )
          .where((eb2) =>
            avatarID === undefined ? eb2.lit(true) : eb2('chain.avatarId', '=', avatarID),
          )
          .forNoKeyUpdate('chain')
          .skipLocked()
          .$asTuple('avatarId', 'scopeType', 'scopeId'),
      ),
    )
    .executeTakeFirst();

  return { cleared: Number(cleared.numUpdatedRows), flagged: Number(flagged.numUpdatedRows) };
}
