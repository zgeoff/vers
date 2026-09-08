import {
  useActivity,
  useAvatar,
  useFailureAction,
  useLastCompletedActivityID,
  useLiveRun,
  useSimulationInitialized,
  useSimulationTransport,
  useWriterAbortSignal,
  useWriterContention,
} from '@vers/idle-client';
import type { LiveRun, WorkerClient } from '@vers/idle-client';
import type { ActivityFailureAction, ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

interface IdleWorkerHandle {
  readonly activity: ActivitySnapshot | undefined;
  readonly avatar: AvatarSnapshot | undefined;
  readonly client: undefined | WorkerClient;
  readonly failureAction: ActivityFailureAction;
  readonly initialized: boolean;
  readonly lastCompletedActivityID: string | undefined;
  readonly liveRun: LiveRun | undefined;
  readonly writerAbortSignal: AbortSignal;
  readonly writerContention: boolean;
}

export function useIdleWorkerHandle(): IdleWorkerHandle {
  const client = useSimulationTransport();
  const initialized = useSimulationInitialized();
  const activity = useActivity();
  const avatar = useAvatar();
  const failureAction = useFailureAction();
  const lastCompletedActivityID = useLastCompletedActivityID();
  const liveRun = useLiveRun();
  const writerAbortSignal = useWriterAbortSignal();
  const writerContention = useWriterContention();

  return {
    activity: activity ?? undefined,
    avatar: avatar ?? undefined,
    client: client ?? undefined,
    failureAction,
    initialized,
    lastCompletedActivityID: lastCompletedActivityID ?? undefined,
    liveRun: liveRun ?? undefined,
    writerAbortSignal,
    writerContention,
  };
}
