import { createRequestResyncMessage } from '@vers/idle-client';

export function sendIdleRequestResync(worker: SharedWorker, avatarID: string): void {
  worker.port.postMessage(createRequestResyncMessage(avatarID));
}
