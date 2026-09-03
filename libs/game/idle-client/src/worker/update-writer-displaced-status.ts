import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';

export function updateWriterDisplacedStatus(
  context: WorkerContext,
  activityID: null | string,
): void {
  if (context.getWriterDisplacedActivityID() === activityID) {
    return;
  }

  context.setWriterDisplacedActivityID(activityID);
  context.broadcast({ activityID, type: WorkerMessageType.WriterDisplaced });
}
