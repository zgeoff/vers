import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { drainActivityStarts } from './drain-activity-starts';
import type { WorkerContext } from './types';

// the service defers a start until every checkpoint of its predecessor has landed, and a deferred
// start waits on a backoff timer of up to minutes; the predecessor's end is the moment it can land
export async function deliverSuccessorStarts(
  context: WorkerContext,
  endedActivityID: string,
): Promise<void> {
  const starts = await readAllActivityStarts();

  const successors = starts.filter((row) => row.predecessorActivityID === endedActivityID);

  if (successors.length === 0) {
    return;
  }

  const submitter = context.getSubmitter();

  const registeredIDs = new Set(submitter.collectActivityStates().map((state) => state.activityID));

  for (const successor of successors) {
    // a registered successor's own flush ingests its start before it sends its checkpoints
    await (registeredIDs.has(successor.id)
      ? submitter.flushNow(successor.id)
      : drainActivityStarts(context, successor.avatarID));
  }
}
