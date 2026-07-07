import { mock } from 'bun:test';
import type { FakeSimulationWorker } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Installs the sanctioned stub for the app's idle-worker-handle boundary, called once from the
 * test preload. `happy-dom` has neither `SharedWorker` nor the Vite worker-import transform the
 * real `@vers/idle-client` hook depends on, so every read goes through `idleWorkerHandleHolder`
 * instead — set it (or leave its default) with `withIdleWorkerHandle`. The two message senders
 * are stubbed to post the same message shape (down to the real `ClientMessageType` string
 * values) the production module posts, so a test asserting on its fake worker's calls observes
 * the real wiring contract.
 */
export function registerIdleWorkerHandleMock(): void {
  void mock.module('../src/lib/idle/idle-worker-handle', () => ({
    sendIdleInitialize: (worker: FakeSimulationWorker) => {
      worker.port.postMessage({ type: 'initialize' });
    },
    sendIdleSetActivity: (worker: FakeSimulationWorker, activity: unknown, avatar: unknown) => {
      worker.port.postMessage({ activity, avatar, type: 'set-activity' });
    },
    useIdleWorkerHandle: () => idleWorkerHandleHolder.current,
  }));
}
