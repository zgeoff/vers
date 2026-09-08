import { buildUndeliveredWork } from '../submission/build-undelivered-work';
import { collectOwnedActivityIDs } from '../submission/collect-owned-activity-ids';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import type { UndeliveredWork, UndeliveredWorkInput } from './worker-contract';

export async function handleReadUndeliveredWorkMessage(
  input: Readonly<UndeliveredWorkInput>,
): Promise<UndeliveredWork> {
  const [starts, checkpoints] = await Promise.all([
    readAllActivityStarts(),
    readAllQueuedCheckpoints(),
  ]);

  const owned = collectOwnedActivityIDs({ avatarIDs: input.avatarIDs, checkpoints, starts });

  return buildUndeliveredWork({
    checkpoints: checkpoints.filter((checkpoint) => owned.has(checkpoint.activityID)),
    startIDs: starts.filter((start) => owned.has(start.id)).map((start) => start.id),
  });
}
