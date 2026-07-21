import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

/**
 * Records which activity another session displaced this device from (`null` when the displacement
 * resolved) and broadcasts the change to every connected tab. Broadcasts only on transition: the
 * reconnect self-resync re-detects an unchanged displacement on every online event, and an
 * unconditional re-broadcast would re-raise a notice the player already dismissed.
 */
export function updateWriterDisplacedStatus(
  context: WorkerContext,
  activityID: null | string,
): void {
  if (context.getWriterDisplacedActivityID() === activityID) {
    return;
  }

  context.setWriterDisplacedActivityID(activityID);

  const message = {
    activityID,
    type: WorkerMessageType.WriterDisplaced,
  } satisfies WorkerMessage;

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
