import type {
  CheckpointFlushStall,
  CheckpointStreamError,
  ClientMessage,
  StartReport,
} from '@vers/idle-client';
import type { ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

/**
 * A duck-typed stand-in for `SharedWorker`: only the one channel the app ever writes to, typed to
 * the worker protocol so recorded messages narrow through the exported guards.
 */
interface StubSimulationWorker {
  readonly port: { readonly postMessage: (message: ClientMessage) => void };
}

export interface StubIdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar?: AvatarSnapshot | undefined;
  readonly checkpointFlushStall?: CheckpointFlushStall | undefined;
  readonly checkpointStreamError?: CheckpointStreamError | undefined;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID?: string | undefined;
  readonly startReport?: StartReport | undefined;
  readonly worker: StubSimulationWorker | undefined;
}

const DEFAULT_HANDLE: StubIdleWorkerHandle = {
  activity: undefined,
  avatar: undefined,
  failureAction: ActivityFailureAction.Abort,
  initialized: false,
  worker: undefined,
};

let current: StubIdleWorkerHandle = DEFAULT_HANDLE;

const listeners = new Set<() => void>();

/**
 * The external store behind the mocked worker-handle read: `set` notifies subscribers, so a
 * mid-test handle change re-renders subscribed components the way a real worker report does.
 * Defaults to no worker, matching a caller that hasn't mounted one yet.
 */
export const idleWorkerHandleStub = {
  get: (): StubIdleWorkerHandle => current,
  reset: (): void => {
    idleWorkerHandleStub.set(DEFAULT_HANDLE);
  },
  set: (handle: Readonly<StubIdleWorkerHandle>): void => {
    current = handle;

    for (const listener of listeners) {
      listener();
    }
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};
