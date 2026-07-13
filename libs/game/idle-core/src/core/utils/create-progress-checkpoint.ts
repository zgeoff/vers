import { levelForXP } from '../../progression';
import type {
  Activity,
  ActivityLevelUp,
  ActivityProgressCheckpoint,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';

/**
 * `activity.updateRewards(rewards)` must already have been applied by the caller — `rewards` is
 * this checkpoint's delta, while `activity.rewards` carries the running total it derives the level
 * crossing from.
 */
export function createProgressCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
  rewards: ActivityRewards,
): ActivityProgressCheckpoint {
  const totalXPAfter = avatar.xp + activity.rewards.xp;
  const totalXPBefore = totalXPAfter - rewards.xp;
  const previousLevel = levelForXP(totalXPBefore);
  const currentLevel = levelForXP(totalXPAfter);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed: ctx.rng.getState(),
    rewards,
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
    ...(levelUp && { levelUp }),
  };
}
