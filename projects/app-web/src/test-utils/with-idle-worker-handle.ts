import type { FakeIdleWorkerHandle } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Drives a call with the mocked worker-handle read set to `handle`, restoring the no-worker
 * default afterward — the only place a test may set what that mocked read returns.
 */
export async function withIdleWorkerHandle<T>(
  handle: Readonly<FakeIdleWorkerHandle>,
  run: () => Promise<T> | T,
): Promise<T> {
  idleWorkerHandleHolder.current = handle;

  try {
    return await run();
  } finally {
    idleWorkerHandleHolder.current = { activity: undefined, initialized: false, worker: undefined };
  }
}
