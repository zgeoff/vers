import type { StubIdleWorkerHandle } from './idle-worker-handle-stub';
import { idleWorkerHandleStub } from './idle-worker-handle-stub';

export function setIdleWorkerHandle(handle: Readonly<StubIdleWorkerHandle>): void {
  idleWorkerHandleStub.set(handle);
}
