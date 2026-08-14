import { createEnemy } from '../../entities/create-enemy';
import type { EnemyData, SimulationContext, Wave, WaveSnapshot } from '../../types';

/**
 * Builds a wave from its already-resolved enemy data verbatim. `index` names this wave's position
 * within its encounter's ordered wave list; each wave and enemy gets a stable, deterministic id,
 * safe to rely on across ticks.
 */
export function createWave(
  index: number,
  enemyData: ReadonlyArray<EnemyData>,
  ctx: SimulationContext,
): Wave {
  // the wave id derives from its position; each enemy id derives from that wave id plus its
  // position within the wave
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
