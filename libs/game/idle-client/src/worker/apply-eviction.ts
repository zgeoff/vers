import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

export function applyEviction(context: WorkerContext, activityID: string): void {
  if (!context.getSubmitter().isEvicted(activityID)) {
    return;
  }

  if (context.getActivity()?.id === activityID) {
    resetSimulation(context);
  }

  updateWriterDisplacedStatus(context, activityID);
}
