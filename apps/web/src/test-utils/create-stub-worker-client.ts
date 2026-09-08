import { mock } from 'bun:test';
import type {
  SimulationSpeedStatus,
  StartStatus,
  UndeliveredWork,
  WorkerClient,
  WorkerDebugSnapshot,
} from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';

interface StubWorkerClientOptions {
  readonly readUndeliveredWork?: WorkerClient['readUndeliveredWork'];
  readonly removeUndeliveredWork?: WorkerClient['removeUndeliveredWork'];
  readonly startActivity?: WorkerClient['startActivity'];
}

interface StubSetFailureActionInput {
  readonly avatarID: string;
  readonly failureAction: ActivityFailureAction;
}

interface StubSetSimulationSpeedInput {
  readonly isQAAvatar: boolean;
  readonly speed: number;
}

const DEFAULT_INITIALIZE_RESULT = {
  rewardSlotLedger: { activityID: null, entries: [] },
  simulationSpeed: 1,
  state: { failureAction: ActivityFailureAction.Abort },
  writerDisplacedActivityID: null,
} as const;

const DEFAULT_START_STATUS: StartStatus = { kind: 'failed' };

const DEFAULT_DEBUG_SNAPSHOT: WorkerDebugSnapshot = {
  capturedAt: 0,
  connectivityOnline: true,
  events: [],
  latestRun: null,
  liveRun: null,
  outbox: { activityStarts: [], checkpoints: [] },
  phase: 'idle',
  simulationSpeed: 1,
  writer: { bootedAt: 0, workerID: 'worker_stub' },
};

const DEFAULT_UNDELIVERED_WORK: UndeliveredWork = { activityCount: 0, playMs: 0 };

export function createStubWorkerClient(
  options: Readonly<StubWorkerClientOptions> = {},
): WorkerClient {
  const client: WorkerClient = {
    cacheNodeSeeds: mock(() => Promise.resolve({ ok: true as const })),
    disconnect: mock(() => Promise.resolve({ ok: true as const })),
    initialize: mock(() => Promise.resolve(DEFAULT_INITIALIZE_RESULT)),
    readDebugSnapshot: mock(() => Promise.resolve(DEFAULT_DEBUG_SNAPSHOT)),
    readUndeliveredWork: mock(
      options.readUndeliveredWork ?? (() => Promise.resolve(DEFAULT_UNDELIVERED_WORK)),
    ),
    removeUndeliveredWork: mock(
      options.removeUndeliveredWork ?? (() => Promise.resolve({ ok: true as const })),
    ),
    reportOnline: mock(() => Promise.resolve({ ok: true as const })),
    setFailureAction: mock((input: StubSetFailureActionInput) =>
      Promise.resolve({ failureAction: input.failureAction }),
    ),
    setSimulationSpeed: mock(
      (input: StubSetSimulationSpeedInput): Promise<SimulationSpeedStatus> => {
        const status: SimulationSpeedStatus =
          input.speed > 1 && !input.isQAAvatar
            ? { kind: 'refused', reason: 'avatar-not-qa' }
            : { kind: 'applied', speed: input.speed };

        return Promise.resolve(status);
      },
    ),
    startActivity: mock(options.startActivity ?? (() => Promise.resolve(DEFAULT_START_STATUS))),
    stopActivity: mock(() => Promise.resolve({ ok: true as const })),
  };

  return client;
}
