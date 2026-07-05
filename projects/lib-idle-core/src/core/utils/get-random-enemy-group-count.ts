import type { SimulationContext } from '../../types';

const MIN_ENEMY_GROUPS = 3;
const MAX_ENEMY_GROUPS = 6;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getRandomEnemyGroupCount(ctx: SimulationContext): number {
  return ctx.rng.getInt(MIN_ENEMY_GROUPS, MAX_ENEMY_GROUPS);
}
