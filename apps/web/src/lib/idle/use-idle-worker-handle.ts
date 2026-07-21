import {
  useActivity,
  useAvatar,
  useFailureAction,
  useLastCompletedActivityID,
  useSimulationInitialized,
  useSimulationTransport,
  useStartReport,
} from '@vers/idle-client';
import type { SimulationTransport, StartReport } from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar: AvatarSnapshot | undefined;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID: string | undefined;
  readonly startReport: StartReport | undefined;
  readonly transport: SimulationTransport | undefined;
}

/**
 * The app's one read boundary onto the simulation transport mount: every consumer reads
 * simulation state through this hook, so tests can stub the worker handle here. The test DOM can
 * host neither a SharedWorker nor a dedicated election worker, so this module is replaced under
 * `bun test`.
 */
export function useIdleWorkerHandle(): IdleWorkerHandle {
  const transport = useSimulationTransport();
  const initialized = useSimulationInitialized();
  const activity = useActivity();
  const avatar = useAvatar();
  const failureAction = useFailureAction();
  const lastCompletedActivityID = useLastCompletedActivityID();
  const startReport = useStartReport();

  return {
    activity: activity ?? undefined,
    avatar: avatar ?? undefined,
    failureAction,
    initialized,
    lastCompletedActivityID: lastCompletedActivityID ?? undefined,
    startReport: startReport ?? undefined,
    transport: transport ?? undefined,
  };
}
