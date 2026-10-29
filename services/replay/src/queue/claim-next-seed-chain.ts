import type { DB } from '@vers/db';
import type { RawBuilder, Transaction } from 'kysely';
import { sql } from 'kysely';
import type { ClaimedActivity } from '../types';

export async function claimNextSeedChain(
  trx: Transaction<DB>,
): Promise<ClaimedActivity | undefined> {
  // The planner prices the walk as if it read every flagged chain, which passes jit_above_cost, and
  // compiling the plan took 60-70 ms against a 1 ms run at 800 avatars on Postgres 16. The setting
  // lasts until the iteration commits, and the rest of the iteration runs point queries too.
  await sql`set local jit = off`.execute(trx);

  const row = await trx
    .selectFrom('activityChains as chain')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('activities')
          .select([
            'activities.id',
            'activities.scopeId',
            'activities.scopeType',
            'activities.status',
          ])
          .whereRef('activities.avatarId', '=', 'chain.avatarId')
          .where((eb2) => eb2('activities.appendedHead', '>', eb2.ref('activities.verifiedHead')))
          .where('activities.status', '!=', 'rejected')

          // a backed-off activity waits out its retry time, and its successors wait behind it
          .where((eb2) =>
            eb2.or([
              eb2('activities.replayBackoffUntil', 'is', null),
              eb2(sql`now()`, '>=', eb2.ref('activities.replayBackoffUntil')),
            ]),
          )
          .where((eb2) => eb2.not(eb2.exists(buildUnsettledAncestorQuery())))
          .orderBy('activities.startChainIndex')
          .limit(1)
          .as('next_activity'),
      (join) => join.onTrue(),
    )
    .select([
      'chain.avatarId',
      'chain.priority',
      'next_activity.id as activityId',
      'next_activity.scopeId',
      'next_activity.scopeType',
    ])
    .where('chain.replayPending', '=', true)
    .whereRef('next_activity.scopeType', '=', 'chain.scopeType')
    .whereRef('next_activity.scopeId', '=', 'chain.scopeId')
    .where('next_activity.status', 'not in', ['quarantined', 'parked'])
    .orderBy('chain.priority', 'desc')
    .orderBy('chain.createdAt')
    .limit(1)

    // the append path takes the chain row FOR KEY SHARE, which this lock admits, so an append
    // never waits out a replay; every request-path writer's FOR UPDATE still excludes it
    .forNoKeyUpdate('chain')
    .skipLocked()
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  return {
    activityID: row.activityId,
    avatarID: row.avatarId,
    priority: row.priority,
    scopeID: row.scopeId,
    scopeType: row.scopeType,
  };
}

// The walk stops at an ancestor the verifier proved part of, since that one was claimed only once
// everything before it settled; UNION rather than UNION ALL ends it on a cycle of declared
// predecessors, which nothing on the request path refuses.
function buildUnsettledAncestorQuery(): RawBuilder<unknown> {
  const isSettled = sql`(ancestor.status = 'rejected' or (ancestor.verified_head >= ancestor.appended_head and ancestor.status not in ('parked', 'quarantined')))`;

  return sql`(
    with recursive walk(ancestor_id) as (
      select activities.predecessor_activity_id
      union
      select ancestor.predecessor_activity_id
      from walk
      join activities as ancestor
        on ancestor.id = walk.ancestor_id and ancestor.avatar_id = activities.avatar_id
      where ancestor.verified_head = 0 and ${isSettled}
    )
    select 1
    from walk
    left join activities as ancestor
      on ancestor.id = walk.ancestor_id and ancestor.avatar_id = activities.avatar_id
    where walk.ancestor_id is not null and (ancestor.id is null or not ${isSettled})
  )`;
}
