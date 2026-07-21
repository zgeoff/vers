import {
  useActivity,
  useAvatar,
  useCheckpointFlushStall,
  useCheckpointStreamError,
  useFailureAction,
  useLastCompletedActivityID,
  useSimulationInitialized,
  useSimulationTransport,
  useStartReport,
} from '@vers/idle-client';
import type {
  CheckpointFlushStall,
  CheckpointStreamError,
  SimulationTransport,
  StartReport,
} from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar: AvatarSnapshot | undefined;
  readonly checkpointFlushStall: CheckpointFlushStall | undefined;
  readonly checkpointStreamError: CheckpointStreamError | undefined;
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
  const checkpointStreamError = useCheckpointStreamError();
  const checkpointFlushStall = useCheckpointFlushStall();
  const lastCompletedActivityID = useLastCompletedActivityID();
  const startReport = useStartReport();

  return {
    activity: activity ?? undefined,
    avatar: avatar ?? undefined,
    checkpointFlushStall: checkpointFlushStall ?? undefined,
    checkpointStreamError: checkpointStreamError ?? undefined,
    failureAction,
    initialized,
    lastCompletedActivityID: lastCompletedActivityID ?? undefined,
    startReport: startReport ?? undefined,
    transport: transport ?? undefined,
  };
}
