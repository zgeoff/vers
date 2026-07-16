import { afterEach, mock } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Stubs the app's idle-worker-handle read: the handle's state (`initialized`, the worker-reported
 * activity and avatar) only ever comes from a live `SharedWorker` session, which `happy-dom`
 * cannot host — so reads go through the in-memory holder instead. The message senders and the
 * encounter visual run real; only this one read is stubbed.
 */
export function registerIdleWorkerHandleMock(): void {
  afterEach(() => {
    idleWorkerHandleHolder.current = {
      activity: undefined,
      avatar: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    };
  });

  void mock.module('../lib/idle/use-idle-worker-handle', () => ({
    useIdleWorkerHandle: () => idleWorkerHandleHolder.current,
  }));
}
