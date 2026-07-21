import {
  useActivity,
  useAvatar,
  useFailureAction,
  useLastCompletedActivityID,
  useSimulationInitialized,
  useSimulationTransport,
  useWriterAbortSignal,
} from '@vers/idle-client';
import type { WorkerClient } from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar: AvatarSnapshot | undefined;
  readonly client: undefined | WorkerClient;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID: string | undefined;
  readonly writerAbortSignal: AbortSignal;
}

/**
 * The app's one read boundary onto the simulation transport mount: every consumer reads
 * simulation state through this hook, so tests can stub the worker handle here. The test DOM can
 * host neither a SharedWorker nor a dedicated election worker, so this module is replaced under
 * `bun test`.
 */
export function useIdleWorkerHandle(): IdleWorkerHandle {
  const client = useSimulationTransport();
  const initialized = useSimulationInitialized();
  const activity = useActivity();
  const avatar = useAvatar();
  const failureAction = useFailureAction();
  const lastCompletedActivityID = useLastCompletedActivityID();
  const writerAbortSignal = useWriterAbortSignal();

  return {
    activity: activity ?? undefined,
    avatar: avatar ?? undefined,
    client: client ?? undefined,
    failureAction,
    initialized,
    lastCompletedActivityID: lastCompletedActivityID ?? undefined,
    writerAbortSignal,
  };
}
