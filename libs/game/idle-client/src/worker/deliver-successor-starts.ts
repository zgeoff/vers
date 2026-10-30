import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import type { WorkerContext } from './types';

// a deferred start waits on a backoff of up to minutes, and its predecessor's end is when it can
// land; only a registered successor flushes, because a discard removes its queue, while a drain here
// would write and register rows after a sign-out's discard had cleared them
export async function deliverSuccessorStarts(
  context: WorkerContext,
  endedActivityID: string,
): Promise<void> {
  const starts = await readAllActivityStarts();

  const submitter = context.getSubmitter();

  const registeredIDs = new Set(submitter.collectActivityStates().map((state) => state.activityID));

  const successors = starts.filter(
    (row) => row.predecessorActivityID === endedActivityID && registeredIDs.has(row.id),
  );

  // a successor's own flush ingests its start before it sends its checkpoints
  for (const successor of successors) {
    await submitter.flushNow(successor.id);
  }
}
