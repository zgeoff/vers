import { buildCompletionXP, levelForXP } from '../../progression';
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
  const nextSeed = ctx.rng.getState();
  const time = activity.elapsed;
  const completionXP = buildCompletionXP(activity.difficulty);
  const rewards: ActivityRewards = { xp: activity.rewards.xp + completionXP };
  const previousLevel = levelForXP(avatar.xp + activity.rewards.xp);
  const currentLevel = levelForXP(avatar.xp + rewards.xp);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed,
    rewards,
    time,
    type: ActivityCheckpointType.Completed,
    ...(levelUp && { levelUp }),
  };
}
