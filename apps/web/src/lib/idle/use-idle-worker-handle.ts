import {
  useActivity,
  useAvatar,
  useCheckpointStreamError,
  useFailureAction,
  useLastCompletedActivityID,
  useSimulationInitialized,
  useSimulationWorker,
} from '@vers/idle-client';
import type { CheckpointStreamError } from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar: AvatarSnapshot | undefined;
  readonly checkpointStreamError: CheckpointStreamError | undefined;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID: string | undefined;
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
  const avatar = useAvatar();
  const failureAction = useFailureAction();
  const checkpointStreamError = useCheckpointStreamError();
  const lastCompletedActivityID = useLastCompletedActivityID();

  return {
    activity: activity ?? undefined,
    avatar: avatar ?? undefined,
    checkpointStreamError: checkpointStreamError ?? undefined,
    failureAction,
    initialized,
    lastCompletedActivityID: lastCompletedActivityID ?? undefined,
    worker: worker ?? undefined,
  };
}
