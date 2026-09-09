import type { StartStatus, WorkerClient } from '@vers/idle-client';
import { syncStoragePersistence } from './sync-storage-persistence';

interface SendIdleStartActivityInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

export function sendIdleStartActivity(
  client: WorkerClient,
  input: Readonly<SendIdleStartActivityInput>,
  signal: AbortSignal,
): Promise<StartStatus> {
  // the player's start is the moment the browser weighs a persistence request by; the answer
  // never gates the start
  void syncStoragePersistence();

  return client.startActivity(
    { avatarID: input.avatarID, scopeID: input.scopeID, scopeType: input.scopeType },
    { signal },
  );
}
