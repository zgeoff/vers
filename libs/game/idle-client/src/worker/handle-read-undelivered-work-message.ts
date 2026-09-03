import { buildUndeliveredWork } from '../submission/build-undelivered-work';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import type { WorkerContext } from './types';
import type { UndeliveredWork } from './worker-contract';

export async function handleReadUndeliveredWorkMessage(
  context: WorkerContext,
): Promise<UndeliveredWork> {
  const [starts, checkpoints] = await Promise.all([
    readAllActivityStarts(),
    readAllQueuedCheckpoints(),
  ]);

  return buildUndeliveredWork({
    checkpoints,
    runningActivityID: context.getActivity()?.id ?? null,
    startIDs: starts.map((start) => start.id),
  });
}
