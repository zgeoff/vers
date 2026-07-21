import type {
  Activity,
  ActivityCheckpointGenerator,
  ActivityExecutor,
  Avatar,
  SimulationContext,
} from '../types';
import { logger } from '../utils/logger';
import { buildWaveClearRewardSlots } from './utils/build-wave-clear-reward-slots';
import { buildWaveClearRewards } from './utils/build-wave-clear-rewards';
import { createCompletedCheckpoint } from './utils/create-completed-checkpoint';
import { createFailedCheckpoint } from './utils/create-failed-checkpoint';
import { createProgressCheckpoint } from './utils/create-progress-checkpoint';
import { createStartedCheckpoint } from './utils/create-started-checkpoint';

export function* runActivity(
  executor: ActivityExecutor,
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityCheckpointGenerator {
  const timestep = yield createStartedCheckpoint(ctx);

  logger.debug(
    () => `[activity:${activity.type}] starting activity with ${activity.waves.length} waves`,
  );

  logger.debug(
    () =>
      `[activity:${activity.type}] starting combat with first wave of ${activity.currentWave?.enemies.length} enemies`,
  );

  while (avatar.isAlive && activity.isWavesRemaining) {
    executor.run(timestep);

    if (activity.currentWave?.remaining === 0) {
      const rewards = buildWaveClearRewards(activity.currentWave);

      const rewardSlotContexts = buildWaveClearRewardSlots(
        activity.currentWave,
        activity.difficulty,
      );

      activity.updateRewards(rewards);

      const checkpoint = createProgressCheckpoint(
        activity,
        avatar,
        ctx,
        rewards,
        rewardSlotContexts,
      );

      if (checkpoint.levelUp) {
        activity.setLevelUp(checkpoint.levelUp);
        avatar.updateLevel(checkpoint.levelUp.to);
      }

      yield checkpoint;
      logger.debug(() => `[activity:${activity.type}] moving to next wave`);

      // move to the next wave
      executor.reset();
      activity.advanceWave();
    } else {
      yield null;
    }
  }

  if (!avatar.isAlive) {
    return createFailedCheckpoint(activity, avatar, ctx);
  }

  const completedCheckpoint = createCompletedCheckpoint(activity, avatar, ctx);

  if (completedCheckpoint.levelUp) {
    activity.setLevelUp(completedCheckpoint.levelUp);
    avatar.updateLevel(completedCheckpoint.levelUp.to);
  }

  return completedCheckpoint;
}
