import { mock } from 'bun:test';
import type { FakeSimulationWorker } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Installs the sanctioned stubs for the app's idle-worker-handle boundary, called once from the
 * test preload. `happy-dom` has neither `SharedWorker` nor the Vite worker-import transform (nor
 * WebGL, for the `AetherNode` visual) the real `@vers/idle-client` exports depend on, so every
 * read goes through `idleWorkerHandleHolder` instead — set it (or leave its default) with
 * `withIdleWorkerHandle`. The two message senders are stubbed to post the same message shape
 * (down to the real `ClientMessageType` string values) the production modules post, so a test
 * asserting on its fake worker's calls observes the real wiring contract.
 */
export function registerIdleWorkerHandleMock(): void {
  void mock.module('../lib/idle/use-idle-worker-handle', () => ({
    useIdleWorkerHandle: () => idleWorkerHandleHolder.current,
  }));

  void mock.module('../lib/idle/send-idle-initialize', () => ({
    sendIdleInitialize: (worker: FakeSimulationWorker) => {
      worker.port.postMessage({ type: 'initialize' });
    },
  }));

  void mock.module('../lib/idle/send-idle-set-activity', () => ({
    sendIdleSetActivity: (worker: FakeSimulationWorker, activity: unknown, avatar: unknown) => {
      worker.port.postMessage({ activity, avatar, type: 'set-activity' });
    },
  }));

  void mock.module('../lib/idle/idle-aether-node', () => ({
    IdleAetherNode: () => 'IDLE_AETHER_NODE',
  }));
}
