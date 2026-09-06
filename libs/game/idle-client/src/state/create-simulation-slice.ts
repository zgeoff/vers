import type { ActivitySnapshot, AvatarSnapshot, CombatExecutorSnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';
import type { LiveRun } from '../worker/live-run-schema';

export interface SimulationSlice {
  activity: ActivitySnapshot | null;
  avatar: AvatarSnapshot | null;
  combat: CombatExecutorSnapshot | null;
  failureAction: ActivityFailureAction;
  liveRun: LiveRun | null;
}

export function createSimulationSlice(): SimulationSlice {
  return {
    activity: null,
    avatar: null,
    combat: null,
    failureAction: ActivityFailureAction.Abort,
    liveRun: null,
  };
}
