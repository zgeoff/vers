import { createInitializeMessage } from '@vers/idle-client';

/**
 * Sends the one-time message a freshly connected worker needs before it reports simulation state.
 */
export function sendIdleInitialize(worker: Pick<SharedWorker, 'port'>): void {
  worker.port.postMessage(createInitializeMessage());
}
