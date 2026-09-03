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
