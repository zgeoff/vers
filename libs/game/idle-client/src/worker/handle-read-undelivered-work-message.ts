import { buildUndeliveredWork } from '../submission/build-undelivered-work';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import type { UndeliveredWork } from './worker-contract';

export async function handleReadUndeliveredWorkMessage(): Promise<UndeliveredWork> {
  const [starts, checkpoints] = await Promise.all([
    readAllActivityStarts(),
    readAllQueuedCheckpoints(),
  ]);

  return buildUndeliveredWork({
    checkpoints,
    startIDs: starts.map((start) => start.id),
  });
}
