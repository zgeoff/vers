import type { ActivitySnapshot, AvatarSnapshot, CombatExecutorSnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';

export interface SimulationSlice {
  activity: ActivitySnapshot | null;
  avatar: AvatarSnapshot | null;
  combat: CombatExecutorSnapshot | null;
  failureAction: ActivityFailureAction;
}

export function createSimulationSlice(): SimulationSlice {
  return {
    activity: null,
    avatar: null,
    combat: null,
    failureAction: ActivityFailureAction.Abort,
  };
}
