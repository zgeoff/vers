import { useActivity, useSimulationInitialized, useSimulationWorker } from '@vers/idle-client';
import type { ActivityAppState } from '@vers/idle-core';

/**
 * The simulation state every idle-driven consumer reads through this hook.
 */
export interface IdleWorkerHandle {
  readonly activity: ActivityAppState | undefined;
  readonly initialized: boolean;
  readonly worker: SharedWorker | undefined;
}

/**
 * The app's one read boundary onto `lib-idle-client`'s SharedWorker mount: every consumer reads
 * simulation state through this hook, so tests can stub the worker handle here. `happy-dom` has
 * neither `SharedWorker` nor the Vite worker-import transform the library depends on, so this
 * module is replaced under `bun test`.
 */
export function useIdleWorkerHandle(): IdleWorkerHandle {
  const worker = useSimulationWorker();
  const initialized = useSimulationInitialized();
  const activity = useActivity();

  return { activity: activity ?? undefined, initialized, worker: worker ?? undefined };
}
