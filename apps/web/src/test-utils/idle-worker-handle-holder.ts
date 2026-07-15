import type { CheckpointStreamError } from '@vers/idle-client';
import type { ActivitySnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

/**
 * A duck-typed stand-in for `SharedWorker`: only the one channel the app ever writes to.
 */
export interface MockSimulationWorker {
  readonly port: { readonly postMessage: (message: unknown) => void };
}

export interface MockIdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly checkpointStreamError?: CheckpointStreamError;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly worker: MockSimulationWorker | undefined;
}

/**
 * The one mutable slot the mocked worker-handle hook reads and the per-test override writer
 * coordinate through. Defaults to no worker, matching a caller that hasn't mounted one yet.
 */
export const idleWorkerHandleHolder: { current: MockIdleWorkerHandle } = {
  current: {
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    worker: undefined,
  },
};
