import { createEnemy } from '../../entities/create-enemy';
import type { EnemyData, SimulationContext, Wave, WaveSnapshot } from '../../types';

export function createWave(
  index: number,
  enemyData: ReadonlyArray<EnemyData>,
  ctx: SimulationContext,
): Wave {
  const id = `wave-${index}`;

  const enemies = enemyData.map((data, enemyIndex) =>
    createEnemy(`${id}-enemy-${enemyIndex}`, data, ctx),
  );

  const getRemainingEnemies = () => enemies.filter((enemy) => enemy.isAlive);

  const getSnapshot = (): WaveSnapshot => ({
    enemies: enemies.map((enemy) => enemy.getSnapshot()),
    id,
  });

  return {
    enemies,
    id,

    get nextLivingEnemy() {
      return getRemainingEnemies()[0] ?? null;
    },
    get remaining() {
      return getRemainingEnemies().length;
    },

    getSnapshot,
  };
}
