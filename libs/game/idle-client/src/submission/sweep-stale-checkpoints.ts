import { buildActivityKeyRange } from './build-activity-key-range';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Deletes every queued checkpoint belonging to an activity outside `keepActivityIDs` — a worker
 * restart has no delivery path for a queued activity other than the avatar's latest, and the
 * server settles rewards authoritatively, so a stranded row is worthless. Returns the distinct
 * activity ids it removed.
 */
export async function sweepStaleCheckpoints(
  keepActivityIDs: ReadonlyArray<string>,
): Promise<Array<string>> {
  const db = await resolveCheckpointQueueDB();
  const keys = await db.getAllKeys(CHECKPOINT_QUEUE_STORE_NAME);

  const keep = new Set(keepActivityIDs);
  const staleActivityIDs = new Set<string>();

  for (const [activityID] of keys) {
    if (!keep.has(activityID)) {
      staleActivityIDs.add(activityID);
    }
  }

  await Promise.all(
    [...staleActivityIDs].map((activityID) =>
      db.delete(CHECKPOINT_QUEUE_STORE_NAME, buildActivityKeyRange(activityID)),
    ),
  );

  return [...staleActivityIDs];
}
