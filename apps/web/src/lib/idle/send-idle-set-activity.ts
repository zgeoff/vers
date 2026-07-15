import type { ActivityData } from '@vers/contract-activity';
import { createSetActivityMessage } from '@vers/idle-client';

/**
 * Tells the worker to start a fresh stream from a newly created activity row — resuming any other
 * activity, live or offline, goes through the resync request instead.
 */
export function sendIdleSetActivity(worker: SharedWorker, activity: Readonly<ActivityData>): void {
  worker.port.postMessage(createSetActivityMessage(activity));
}
