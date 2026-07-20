import { createStopActivityMessage } from '@vers/idle-client';

/**
 * Tells the worker to end the named run. The worker halts the local simulation immediately and
 * owns delivery of the server stop — flushing earned checkpoints first and retrying from a durable
 * intent on later reconnects — so the caller never awaits the server and the stop works offline.
 */
export function sendIdleStopActivity(
  worker: Pick<SharedWorker, 'port'>,
  avatarID: string,
  activityID: string,
): void {
  worker.port.postMessage(createStopActivityMessage(avatarID, activityID));
}
