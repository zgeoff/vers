import { buildUndeliveredWork } from '../submission/build-undelivered-work';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import type { WorkerContext } from './types';
import type { UndeliveredWork } from './worker-contract';

/**
 * Reports what this device holds that the server has never verified: the durable stores' pending
 * activity starts and queued checkpoints, plus the activity the live simulation is running, if
 * any.
 */
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
