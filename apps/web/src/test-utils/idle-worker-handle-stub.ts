import type { LiveRun, WorkerClient } from '@vers/idle-client';
import type { ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

export interface StubIdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar?: AvatarSnapshot | undefined;
  readonly client: undefined | WorkerClient;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID?: string | undefined;
  readonly liveRun?: LiveRun | undefined;
  readonly writerAbortSignal: AbortSignal;
}

const DEFAULT_HANDLE: StubIdleWorkerHandle = {
  activity: undefined,
  avatar: undefined,
  client: undefined,
  failureAction: ActivityFailureAction.Abort,
  initialized: false,
  writerAbortSignal: new AbortController().signal,
};

let current: StubIdleWorkerHandle = DEFAULT_HANDLE;

const listeners = new Set<() => void>();

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
