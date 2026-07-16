import type { StubIdleWorkerHandle } from './idle-worker-handle-stub';
import { idleWorkerHandleStub } from './idle-worker-handle-stub';

/**
 * Sets what the mocked worker-handle read returns — the only place a test may write it. Already
 * mounted components re-render on the new handle, so a mid-test call stands in for a worker
 * report. The preload's registration resets the handle after each test.
 */
export function setIdleWorkerHandle(handle: Readonly<StubIdleWorkerHandle>): void {
  idleWorkerHandleStub.set(handle);
}
