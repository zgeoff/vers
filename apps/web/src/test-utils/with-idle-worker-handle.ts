import { ActivityFailureAction } from '@vers/idle-core';
import type { StubIdleWorkerHandle } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Drives a call with the mocked worker-handle read set to `handle`, restoring the no-worker
 * default afterward — the only place a test may set what that mocked read returns.
 */
export async function withIdleWorkerHandle<T>(
  handle: Readonly<StubIdleWorkerHandle>,
  run: () => Promise<T> | T,
): Promise<T> {
  idleWorkerHandleHolder.current = handle;

  try {
    return await run();
  } finally {
    idleWorkerHandleHolder.current = {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    };
  }
}
