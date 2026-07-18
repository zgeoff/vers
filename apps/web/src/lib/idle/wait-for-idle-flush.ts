import type { WorkerMessage } from '@vers/idle-client';
import { WorkerMessageType, createRequestFlushMessage } from '@vers/idle-client';

const FLUSH_ACK_TIMEOUT_MS = 5000;

/**
 * Asks the worker to deliver an activity's queued checkpoints now and waits for its ack — a tab
 * about to stop the activity server-side would otherwise lose whatever the worker's shared
 * progress window still holds unsent. Resolves on the matching ack or after `timeoutMs`, so a dead
 * or offline worker never wedges the caller; either outcome removes the listener and clears the
 * timer.
 */
export function waitForIdleFlush(
  worker: SharedWorker,
  activityID: string,
  timeoutMs: number = FLUSH_ACK_TIMEOUT_MS,
): Promise<void> {
  const requestID = crypto.randomUUID();

  return new Promise((resolve) => {
    let settled = false;

    const resolveFlush = (): void => {
      if (settled) {
        return;
      }

      settled = true;

      worker.port.removeEventListener('message', handleMessage);

      clearTimeout(timer);

      // oxlint-disable-next-line promise/no-multiple-resolved -- reachable from both the ack listener and the timeout, but the `settled` guard above ensures only one of them ever calls this
      resolve();
    };

    const handleMessage = (event: MessageEvent<WorkerMessage>): void => {
      if (
        event.data.type === WorkerMessageType.FlushCompleted &&
        event.data.requestID === requestID
      ) {
        resolveFlush();
      }
    };

    const timer = setTimeout(resolveFlush, timeoutMs);

    worker.port.addEventListener('message', handleMessage);
    worker.port.postMessage(createRequestFlushMessage(activityID, requestID));
  });
}
