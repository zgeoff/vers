import type { ActivityData } from '@vers/contract-activity';
import { createSetActivityMessage } from '@vers/idle-client';

/**
 * Tells the worker to start a fresh stream from the row a `startActivity` mutation just returned
 * — resuming any other activity, live or offline, goes through `sendIdleRequestResync` instead.
 */
export function sendIdleSetActivity(worker: SharedWorker, activity: Readonly<ActivityData>): void {
  worker.port.postMessage(createSetActivityMessage(activity));
}
