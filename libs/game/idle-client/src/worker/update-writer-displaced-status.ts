import { createWriterDisplacedMessage } from './create-writer-displaced-message';
import type { WorkerContext } from './types';

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

  const message = createWriterDisplacedMessage(activityID);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
