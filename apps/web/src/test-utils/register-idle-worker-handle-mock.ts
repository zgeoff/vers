import { afterEach, mock } from 'bun:test';
import { useSyncExternalStore } from 'react';
import { idleWorkerHandleStub } from './idle-worker-handle-stub';

export function registerIdleWorkerHandleMock(): void {
  afterEach(() => {
    idleWorkerHandleStub.reset();
  });

  void mock.module('../lib/idle/use-idle-worker-handle', () => ({
    useIdleWorkerHandle: () =>
      useSyncExternalStore(idleWorkerHandleStub.subscribe, idleWorkerHandleStub.get),
  }));
}
