import type { CheckpointFlushStall, CheckpointStreamError } from '@vers/idle-client';
import type { ActivitySnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

/**
 * A duck-typed stand-in for `SharedWorker`: only the one channel the app ever writes to.
 */
export interface StubSimulationWorker {
  readonly port: { readonly postMessage: (message: unknown) => void };
}

export interface StubIdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly checkpointFlushStall?: CheckpointFlushStall;
  readonly checkpointStreamError?: CheckpointStreamError;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly worker: StubSimulationWorker | undefined;
}

/**
 * The one mutable slot the mocked worker-handle hook reads and the per-test override writer
 * coordinate through. Defaults to no worker, matching a caller that hasn't mounted one yet.
 */
export const idleWorkerHandleHolder: { current: StubIdleWorkerHandle } = {
  current: {
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    worker: undefined,
  },
};
