import { createRequestResyncMessage } from '@vers/idle-client';

export function sendIdleRequestResync(worker: Pick<SharedWorker, 'port'>, avatarID: string): void {
  worker.port.postMessage(createRequestResyncMessage(avatarID));
}
