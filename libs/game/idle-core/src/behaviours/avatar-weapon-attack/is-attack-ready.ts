import type { Avatar, AvatarWeaponAttackBehaviourState, CombatExecutor } from '../../types';
import { getNextAttackTime } from './get-next-attack-time';

export function isAttackReady(
  entity: Avatar,
  state: AvatarWeaponAttackBehaviourState,
  executor: CombatExecutor,
): boolean {
  if (!entity.isAlive) {
    return false;
  }

  return executor.elapsed >= getNextAttackTime(entity, state);
}
