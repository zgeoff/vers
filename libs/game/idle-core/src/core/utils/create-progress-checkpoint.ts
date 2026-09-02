import { buildLevelFromXP } from '../../progression';
import type {
  Activity,
  ActivityLevelUp,
  ActivityProgressCheckpoint,
  ActivityRewards,
  Avatar,
  RewardSlotContext,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';

export function createProgressCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
  rewards: ActivityRewards,
  rewardSlotContexts: ReadonlyArray<RewardSlotContext>,
): ActivityProgressCheckpoint {
  const totalXPAfter = avatar.xp + activity.rewards.xp;
  const totalXPBefore = totalXPAfter - rewards.xp;
  const previousLevel = buildLevelFromXP(totalXPBefore);
  const currentLevel = buildLevelFromXP(totalXPAfter);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed: ctx.rng.getState(),
    rewards,
    rewardSlots: rewardSlotContexts.map((context, ordinal) => ({ context, ordinal })),
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
    ...(levelUp && { levelUp }),
  };
}
