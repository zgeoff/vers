import { createEnemy } from '../../entities/create-enemy';
import type { ActivityInput, Enemy, SimulationContext } from '../../types';

export function getRandomEnemies(
  activity: ActivityInput,
  count: number,
  ctx: SimulationContext,
): Array<Enemy> {
  if (activity.enemies.length === 1) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by the length === 1 check above
    const makeOnlyEnemy = () => createEnemy(activity.enemies[0]!, ctx);

    return Array.from({ length: count }, makeOnlyEnemy);
  }

  return (
    ctx.rng
      .getSeries(0, activity.enemies.length - 1, count)

      // oxlint-disable-next-line typescript/no-non-null-assertion -- getSeries only yields indexes inside the enemies array bounds
      .map((index) => createEnemy(activity.enemies[index]!, ctx))
  );
}
