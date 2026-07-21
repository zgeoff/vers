import type { StartStatus, WorkerClient } from '@vers/idle-client';

interface SendIdleStartActivityInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Asks the worker to begin a run for the given scope; it owns the start end to end and answers
 * with the outcome directly.
 */
export function sendIdleStartActivity(
  client: WorkerClient,
  input: Readonly<SendIdleStartActivityInput>,
  signal: AbortSignal,
): Promise<StartStatus> {
  return client.startActivity(
    { avatarID: input.avatarID, scopeID: input.scopeID, scopeType: input.scopeType },
    { signal },
  );
}
