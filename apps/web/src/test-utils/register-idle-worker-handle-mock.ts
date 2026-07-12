import { mock } from 'bun:test';
import type { FakeSimulationWorker } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Stubs the app's idle-worker-handle boundary. `happy-dom` has neither `SharedWorker` nor WebGL
 * (for the `WorldMapEncounterActivity` visual) the real `@vers/idle-client` exports depend on, so
 * reads go through the in-memory holder instead. The message senders post the production message
 * shape, so a test asserting on its fake worker's calls sees the real wiring contract.
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

  void mock.module('../lib/idle/send-idle-set-failure-action', () => ({
    sendIdleSetFailureAction: (worker: FakeSimulationWorker, failureAction: unknown) => {
      worker.port.postMessage({ failureAction, type: 'set-failure-action' });
    },
  }));

  void mock.module('../lib/idle/idle-world-map-encounter-activity', () => ({
    IdleWorldMapEncounterActivity: () => 'IDLE_WORLD_MAP_ENCOUNTER',
  }));
}
