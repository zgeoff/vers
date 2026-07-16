import type { StubIdleWorkerHandle } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Drives a call with the mocked worker-handle read set to `handle` — the only place a test may
 * set what that mocked read returns. The preload's registration resets the holder after each
 * test, so no restore happens here.
 */
export function withIdleWorkerHandle<T>(
  handle: Readonly<StubIdleWorkerHandle>,
  run: () => Promise<T> | T,
): Promise<T> | T {
  idleWorkerHandleHolder.current = handle;

  return run();
}
