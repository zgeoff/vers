import type { Enemy, SimulationContext } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function calcEnemyAttackDamage(enemy: Enemy, ctx: SimulationContext): number {
  return ctx.rng.getInt(enemy.primaryAttack.minDamage, enemy.primaryAttack.maxDamage);
}
