import { afterEach, mock } from 'bun:test';
import { useSyncExternalStore } from 'react';
import { idleWorkerHandleStub } from './idle-worker-handle-stub';

/**
 * Stubs the app's idle-worker-handle read: the handle's state (`initialized`, the worker-reported
 * activity and avatar) only ever comes from a live `SharedWorker` session, which `happy-dom`
 * cannot host — so reads subscribe to the in-memory stub store instead. The message senders and
 * the encounter visual run real; only this one read is stubbed.
 */
export function registerIdleWorkerHandleMock(): void {
  afterEach(() => {
    idleWorkerHandleStub.reset();
  });

  void mock.module('../lib/idle/use-idle-worker-handle', () => ({
    useIdleWorkerHandle: () =>
      useSyncExternalStore(idleWorkerHandleStub.subscribe, idleWorkerHandleStub.get),
  }));
}
