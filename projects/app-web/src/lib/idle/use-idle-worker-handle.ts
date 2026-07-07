import { useActivity, useSimulationInitialized, useSimulationWorker } from '@vers/idle-client';
import type { ActivityAppState } from '@vers/idle-core';

/** The simulation state every idle-driven surface reads through `useIdleWorkerHandle`. */
export interface IdleWorkerHandle {
  readonly activity: ActivityAppState | undefined;
  readonly initialized: boolean;
  readonly worker: SharedWorker | undefined;
}

/**
 * The app's one read seam onto `lib-idle-client`'s SharedWorker mount: every consumer reads
 * simulation state through this hook instead of the library directly, so tests can stub the
 * worker handle at this boundary. `happy-dom` has neither `SharedWorker` nor the Vite
 * worker-import transform the library's own (still-vitest) tests depend on, so this module is
 * replaced wholesale under `bun test` rather than driven for real — see
 * `test-utils/register-idle-worker-handle-mock.ts`.
 */
export function useIdleWorkerHandle(): IdleWorkerHandle {
  const worker = useSimulationWorker();
  const initialized = useSimulationInitialized();
  const activity = useActivity();

  return { activity: activity ?? undefined, initialized, worker: worker ?? undefined };
}
