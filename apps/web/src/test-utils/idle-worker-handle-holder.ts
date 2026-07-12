import type { ActivityAppState } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

/**
 * A duck-typed stand-in for `SharedWorker`: only the one channel the app ever writes to.
 */
export interface FakeSimulationWorker {
  readonly port: { readonly postMessage: (message: unknown) => void };
}

/**
 * The fake shape the mocked worker-handle read hands back in place of the real hook's return.
 */
export interface FakeIdleWorkerHandle {
  readonly activity: ActivityAppState | undefined;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly worker: FakeSimulationWorker | undefined;
}

/**
 * The one mutable slot the mocked worker-handle hook reads and the per-test override writer
 * coordinate through. Defaults to no worker, matching a caller that hasn't mounted one yet.
 */
export const idleWorkerHandleHolder: { current: FakeIdleWorkerHandle } = {
  current: {
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    worker: undefined,
  },
};
