import { createStartActivityMessage } from '@vers/idle-client';

interface SendIdleStartActivityInput {
  readonly avatarID: string;
  readonly requestID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Asks the worker to begin a run for the given scope. The worker owns the server start, any
 * conflict recovery, and the simulation install, and answers with a start status carrying the
 * same request id — the tab only correlates that report against its outstanding attempt.
 */
export function sendIdleStartActivity(
  worker: Pick<SharedWorker, 'port'>,
  input: Readonly<SendIdleStartActivityInput>,
): void {
  worker.port.postMessage(createStartActivityMessage(input));
}
