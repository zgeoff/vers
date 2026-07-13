import type {
  Activity,
  ActivityCheckpointGenerator,
  ActivityExecutor,
  Avatar,
  SimulationContext,
} from '../types';
import { logger } from '../utils/logger';
import { buildWaveClearRewards } from './utils/build-wave-clear-rewards';
import { createCompletedCheckpoint } from './utils/create-completed-checkpoint';
import { createFailedCheckpoint } from './utils/create-failed-checkpoint';
import { createProgressCheckpoint } from './utils/create-progress-checkpoint';
import { createStartedCheckpoint } from './utils/create-started-checkpoint';

// oxlint-disable-next-line typescript/require-await -- callers drive this generator with awaited next()/return() calls, so it must satisfy the AsyncGenerator contract even though its own body has no await
export async function* simulateActivity(
  executor: ActivityExecutor,
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityCheckpointGenerator {
  const timestep = yield createStartedCheckpoint(ctx);
  const label = `[activity:${activity.type}]`;

  logger.debug(`${label} starting activity with ${activity.waves.length} waves`);

  logger.debug(
    `${label} starting combat with first wave of ${activity.currentWave?.enemies.length} enemies`,
  );

  while (avatar.isAlive && activity.isWavesRemaining) {
    executor.run(timestep);

    if (activity.currentWave?.remaining === 0) {
      const rewards = buildWaveClearRewards(activity.currentWave, activity.difficulty);

      activity.updateRewards(rewards);

      const checkpoint = createProgressCheckpoint(activity, avatar, ctx, rewards);

      if (checkpoint.levelUp) {
        activity.setLevelUp(checkpoint.levelUp);
        avatar.updateLevel(checkpoint.levelUp.to);
      }

      yield checkpoint;
      logger.debug(`${label} moving to next wave`);

      // move to the next wave
      executor.reset();
      activity.moveToNextWave();
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
