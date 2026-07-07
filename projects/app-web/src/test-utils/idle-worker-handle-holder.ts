import type { ActivityAppState } from '@vers/idle-core';

/** A duck-typed stand-in for `SharedWorker`: only the one channel the app ever writes to. */
export interface FakeSimulationWorker {
  readonly port: { readonly postMessage: (message: unknown) => void };
}

/** The fake shape `registerIdleWorkerHandleMock`'s stub hands back in place of the real hook's read. */
export interface FakeIdleWorkerHandle {
  readonly activity: ActivityAppState | undefined;
  readonly initialized: boolean;
  readonly worker: FakeSimulationWorker | undefined;
}

/**
 * The one mutable slot `withIdleWorkerHandle` and the mocked `useIdleWorkerHandle` coordinate
 * through. Defaults to no worker at all, matching a caller that hasn't mounted one yet.
 */
export const idleWorkerHandleHolder: { current: FakeIdleWorkerHandle } = {
  current: { activity: undefined, initialized: false, worker: undefined },
};
