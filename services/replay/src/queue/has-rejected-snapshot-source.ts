import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/**
 * Whether a run whose unsettled xp fed this activity's build snapshot has since been rejected. The
 * snapshot is stamped at start and replayed as the verifier's simulation input rather than
 * re-derived, so a rejected source leaves the activity playing a level and life the avatar never
 * proved it had, and no replay of it can be adjudicated on its merits.
 *
 * A source is only ever read once the claim has established it has no appends left past its
 * verified cursor, so a false answer means every source verified rather than that one is still
 * being adjudicated.
 */
export async function hasRejectedSnapshotSource(
  db: Kysely<DB>,
  activityID: string,
): Promise<boolean> {
  const rejected = await db
    .selectFrom('activitySnapshotSources as edge')
    .innerJoin('activities as source', 'source.id', 'edge.sourceActivityId')
    .select('edge.sourceActivityId')
    .where('edge.activityId', '=', activityID)
    .where('source.status', '=', 'rejected')
    .executeTakeFirst();

  return rejected !== undefined;
}
