import { buildCompletionXP, buildLevelFromXP } from '../../progression';
import type {
  Activity,
  ActivityCompletedCheckpoint,
  ActivityLevelUp,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';

export function createCompletedCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityCompletedCheckpoint {
  const completionXP = buildCompletionXP(activity.difficulty);
  const rewards: ActivityRewards = { xp: activity.rewards.xp + completionXP };
  const previousLevel = buildLevelFromXP(avatar.xp + activity.rewards.xp);
  const currentLevel = buildLevelFromXP(avatar.xp + rewards.xp);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed: ctx.rng.getState(),
    rewards,
    rewardSlots: [],
    time: activity.elapsed,
    type: ActivityCheckpointType.Completed,
    ...(levelUp && { levelUp }),
  };
}
