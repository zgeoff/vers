import type { FakeIdleWorkerHandle } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Drives a call with the mocked worker-handle read set to `handle`, restoring the no-worker
 * default afterward — the only place a test may set what that mocked read returns.
 */
export async function withIdleWorkerHandle<T>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- FakeIdleWorkerHandle's activity field carries @vers/idle-core's ActivityAppState, which nests mutable arrays; a framework type with no readonly form
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
