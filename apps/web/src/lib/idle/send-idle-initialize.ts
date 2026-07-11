import { createInitializeMessage } from '@vers/idle-client';

/**
 * Sends the one-time message a freshly connected worker needs before it reports simulation state.
 */
export function sendIdleInitialize(worker: SharedWorker): void {
  worker.port.postMessage(createInitializeMessage());
}
