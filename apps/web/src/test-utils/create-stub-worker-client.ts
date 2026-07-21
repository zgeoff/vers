import { mock } from 'bun:test';
import type { StartStatus, WorkerClient } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';

interface StubWorkerClientOptions {
  readonly startActivity?: WorkerClient['startActivity'];
}

interface StubSetFailureActionInput {
  readonly avatarID: string;
  readonly failureAction: ActivityFailureAction;
}

const DEFAULT_INITIALIZE_RESULT = {
  rewardSlotLedger: { activityID: null, entries: [] },
  state: { failureAction: ActivityFailureAction.Abort },
  writerDisplacedActivityID: null,
} as const;

const DEFAULT_START_STATUS: StartStatus = { kind: 'failed' };

/**
 * A duck-typed stand-in for the worker RPC client: every procedure is a tracked mock resolving a
 * reasonable default, so a test can assert on calls and override `startActivity` for its own
 * outcome without standing up a real transport.
 */
export function createStubWorkerClient(
  options: Readonly<StubWorkerClientOptions> = {},
): WorkerClient {
  const client: WorkerClient = {
    disconnect: mock(() => Promise.resolve({ ok: true as const })),
    initialize: mock(() => Promise.resolve(DEFAULT_INITIALIZE_RESULT)),
    reportOnline: mock(() => Promise.resolve({ ok: true as const })),
    setFailureAction: mock((input: StubSetFailureActionInput) =>
      Promise.resolve({ failureAction: input.failureAction }),
    ),
    startActivity: mock(options.startActivity ?? (() => Promise.resolve(DEFAULT_START_STATUS))),
    stopActivity: mock(() => Promise.resolve({ ok: true as const })),
  };

  return client;
}
