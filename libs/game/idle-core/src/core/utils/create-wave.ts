import { createId } from '@paralleldrive/cuid2';
import type { ActivityInput, SimulationContext, Wave, WaveSnapshot } from '../../types';
import { getRandomEnemies } from './get-random-enemies';

export function createWave(
  activity: ActivityInput,
  ctx: SimulationContext,
  enemyCount: number,
): Wave {
  const id = createId();
  const enemies = getRandomEnemies(activity, enemyCount, ctx);
  const getRemainingEnemies = () => enemies.filter((enemy) => enemy.isAlive);

  const getSnapshot = (): WaveSnapshot => ({
    enemies: enemies.map((enemy) => enemy.getSnapshot()),
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
    getSnapshot,
  };
}
