import {
  useActivity,
  useFailureAction,
  useSimulationInitialized,
  useSimulationWorker,
} from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot } from '@vers/idle-core';

/**
 * The simulation state every idle-driven consumer reads through this hook.
 */
interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly worker: SharedWorker | undefined;
}

/**
 * The app's one read boundary onto `lib-idle-client`'s SharedWorker mount: every consumer reads
 * simulation state through this hook, so tests can stub the worker handle here. `happy-dom` has no
 * `SharedWorker` implementation, so this module is replaced under `bun test`.
 */
export function useIdleWorkerHandle(): IdleWorkerHandle {
  const worker = useSimulationWorker();
  const initialized = useSimulationInitialized();
  const activity = useActivity();
  const failureAction = useFailureAction();

  return {
    activity: activity ?? undefined,
    failureAction,
    initialized,
    worker: worker ?? undefined,
  };
}
