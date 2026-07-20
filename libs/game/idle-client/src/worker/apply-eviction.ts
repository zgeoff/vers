import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

/**
 * Settles a server eviction at a lifecycle-safe point: the displaced simulation (when it is still
 * the live one) is cleared and the displacement recorded and broadcast. Skips entirely when the
 * eviction marker no longer holds — a claiming pass re-registered the stream in the meantime, so
 * the displacement is resolved and tearing down the run it installed would be wrong.
 */
export function applyEviction(context: WorkerContext, activityID: string): void {
  if (!context.getSubmitter().isEvicted(activityID)) {
    return;
  }

  if (context.getActivity()?.id === activityID) {
    resetSimulation(context);
  }

  updateWriterDisplacedStatus(context, activityID);
}
