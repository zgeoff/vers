import { createId } from '@paralleldrive/cuid2';
import type { ActivityData, SimulationContext, Wave, WaveAppState } from '../../types';
import { getRandomEnemies } from './get-random-enemies';

export function createWave(
  activity: ActivityData,
  ctx: SimulationContext,
  enemyCount: number,
): Wave {
  const id = createId();
  const enemies = getRandomEnemies(activity, enemyCount, ctx);
  const getRemainingEnemies = () => enemies.filter((enemy) => enemy.isAlive);

  const getAppState = (): WaveAppState => ({
    enemies: enemies.map((enemy) => enemy.getAppState()),
    id,
  });

  return {
    // meta
    enemies,
    id,

    // getters
    get nextLivingEnemy() {
      return getRemainingEnemies()[0] ?? null;
    },
    get remaining() {
      return getRemainingEnemies().length;
    },

    // core
    getAppState,
  };
}
