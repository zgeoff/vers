import { mock } from 'bun:test';
import type { StubSimulationWorker } from './idle-worker-handle-holder';
import { idleWorkerHandleHolder } from './idle-worker-handle-holder';

/**
 * Stubs the app's idle-worker-handle boundary. `happy-dom` has neither `SharedWorker` nor WebGL
 * (for the `WorldMapEncounterActivity` visual) the real `@vers/idle-client` exports depend on, so
 * reads go through the in-memory holder instead. The message senders post the production message
 * shape, so a test asserting on its stub worker's calls sees the real wiring contract.
 */
export function registerIdleWorkerHandleMock(): void {
  void mock.module('../lib/idle/use-idle-worker-handle', () => ({
    useIdleWorkerHandle: () => idleWorkerHandleHolder.current,
  }));

  void mock.module('../lib/idle/send-idle-initialize', () => ({
    sendIdleInitialize: (worker: StubSimulationWorker) => {
      worker.port.postMessage({ type: 'initialize' });
    },
  }));

  void mock.module('../lib/idle/send-idle-set-activity', () => ({
    sendIdleSetActivity: (worker: StubSimulationWorker, activity: unknown) => {
      worker.port.postMessage({ activity, type: 'set_activity' });
    },
  }));

  void mock.module('../lib/idle/send-idle-set-failure-action', () => ({
    sendIdleSetFailureAction: (worker: StubSimulationWorker, failureAction: unknown) => {
      worker.port.postMessage({ failureAction, type: 'set_failure_action' });
    },
  }));

  void mock.module('../lib/idle/send-idle-request-resync', () => ({
    sendIdleRequestResync: (worker: StubSimulationWorker, avatarID: unknown) => {
      worker.port.postMessage({ avatarID, type: 'request_resync' });
    },
  }));

  void mock.module('../lib/idle/idle-world-map-encounter-activity', () => ({
    IdleWorldMapEncounterActivity: () => 'IDLE_WORLD_MAP_ENCOUNTER',
  }));
}
