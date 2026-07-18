import type { RequestFlushMessage } from '../types';
import { createFlushCompletedMessage } from './create-flush-completed-message';
import type { WorkerContext } from './types';

/**
 * Delivers an activity's queued checkpoints now, then acks back to the requesting port only —
 * every other connected tab stays silent, since this reports one specific request's completion,
 * not a broadcast state change.
 */
export async function handleRequestFlushMessage(
  context: WorkerContext,
  port: MessagePort,
  message: RequestFlushMessage,
): Promise<void> {
  await context.getSubmitter().flushNow(message.activityID);

  port.postMessage(createFlushCompletedMessage(message.activityID, message.requestID));
}
