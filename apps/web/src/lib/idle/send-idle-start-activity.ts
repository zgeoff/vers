import { createStartActivityMessage } from '@vers/idle-client';

interface SendIdleStartActivityInput {
  readonly avatarID: string;
  readonly requestID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Asks the worker to begin a run for the given scope; it owns the start end to end and answers
 * with a status carrying the same request id for the tab to correlate.
 */
export function sendIdleStartActivity(
  worker: Pick<SharedWorker, 'port'>,
  input: Readonly<SendIdleStartActivityInput>,
): void {
  worker.port.postMessage(createStartActivityMessage(input));
}
