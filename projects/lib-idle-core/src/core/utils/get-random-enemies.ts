import { createEnemy } from '../../entities/create-enemy';
import type { ActivityData, Enemy, SimulationContext } from '../../types';

export function getRandomEnemies(
  activity: ActivityData,
  count: number,
  ctx: SimulationContext,
): Array<Enemy> {
  if (activity.enemies.length === 1) {
    return Array.from({ length: count }, () =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      createEnemy(activity.enemies[0]!, ctx),
    );
  }

  return (
    ctx.rng
      .getSeries(0, activity.enemies.length - 1, count)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((index) => createEnemy(activity.enemies[index]!, ctx))
  );
}
