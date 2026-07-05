import type { CombatExecutor, Enemy, EnemyPrimaryAttackBehaviourState } from '../../types';
import { getNextAttackTime } from './get-next-attack-time';

export function isAttackReady(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  entity: Enemy,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  state: EnemyPrimaryAttackBehaviourState,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  executor: CombatExecutor,
): boolean {
  if (!entity.isAlive) {
    return false;
  }

  return executor.elapsed >= getNextAttackTime(entity, state);
}
