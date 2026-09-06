import type { LiveRun } from './live-run-schema';
import type { WorkerContext } from './types';

export function findLiveRun(context: WorkerContext): LiveRun | undefined {
  const activity = context.getActivity();

  // the held row outlives its simulation: a stopped run's row stays until the next install, so
  // only a row whose simulation is the one ticking counts as live
  if (activity === null || context.getSimulation().activity?.id !== activity.id) {
    return undefined;
  }

  return {
    avatarID: activity.avatarID,
    id: activity.id,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  };
}
