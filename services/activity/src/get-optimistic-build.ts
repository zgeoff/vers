import type { DB } from '@vers/db';
import type { OptimisticBuild } from '@vers/idle-core';
import { foldOptimisticBuild } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';

/**
 * An avatar's settled xp plus the unsettled xp of every activity that ended and is still awaiting
 * its verifier — what a new run's build snapshot is stamped with — beside the runs that xp came
 * from. A `parked` or `quarantined` activity is left out: both are holds with no path back to
 * verification on their own, so counting them would stamp xp that never settles into this run's
 * snapshot and every later one's. The settled row and the unsettled set are read in one statement,
 * so a concurrent verifier commit can't land its delta in the gap between two separate reads.
 */
export async function getOptimisticBuild(
  trx: Kysely<DB>,
  avatarID: string,
): Promise<OptimisticBuild> {
  const rows = await trx
    .selectFrom('avatars')
    .leftJoin('activities', (join) =>
      join
        .onRef('activities.avatarId', '=', 'avatars.id')
        .on('activities.status', 'in', ['stopped', 'capped'])
        .onRef('activities.verifiedHead', '<', 'activities.appendedHead'),
    )
    .leftJoin('activityCheckpoints', (join) =>
      join
        .onRef('activityCheckpoints.activityId', '=', 'activities.id')
        .onRef('activityCheckpoints.version', '=', 'activities.appendedHead'),
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('activityCheckpoints as unverified')
          .select(
            sql<string>`coalesce(sum((unverified.payload -> 'rewards' ->> 'xp')::integer), 0)`.as(
              'deltaSum',
            ),
          )
          .whereRef('unverified.activityId', '=', 'activities.id')
          .whereRef('unverified.version', '>', 'activities.verifiedHead')
          .as('unsettled'),
      (join) => join.onTrue(),
    )
    .select([
      'avatars.xp',
      'activities.id',
      'activities.settledXp',
      'activityCheckpoints.payload',
      'unsettled.deltaSum',
    ])
    .where('avatars.id', '=', avatarID)
    .execute();

  const [settled] = rows;

  invariant(
    settled !== undefined,
    'avatar must still exist inside the transaction that starts its activity',
  );

  // The left join yields one all-null activity row for an avatar with nothing unsettled, so a null
  // id marks the absence of a source rather than a source without one.
  const sources = rows
    .filter((row): row is typeof row & { id: string } => row.id !== null)
    .map((row) => ({
      id: row.id,
      settledXP: row.settledXp ?? 0,
      tailPayload: row.payload,
      unverifiedDeltaSum: Number(row.deltaSum ?? 0),
    }));

  return foldOptimisticBuild(settled.xp, sources);
}
