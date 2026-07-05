import type { Avatar, AvatarWeaponAttackBehaviourState, CombatExecutor } from '../../types';
import { getNextAttackTime } from './get-next-attack-time';

export function isAttackReady(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  entity: Avatar,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  state: AvatarWeaponAttackBehaviourState,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  executor: CombatExecutor,
): boolean {
  if (!entity.isAlive) {
    return false;
  }

  return executor.elapsed >= getNextAttackTime(entity, state);
}
