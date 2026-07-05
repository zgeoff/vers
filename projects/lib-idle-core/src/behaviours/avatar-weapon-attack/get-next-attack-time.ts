import type { Avatar, AvatarWeaponAttackBehaviourState } from '../../types';
import { getAttackIntervalMS } from './get-attack-interval-ms';

export function getNextAttackTime(entity: Avatar, state: AvatarWeaponAttackBehaviourState): number {
  return state.lastAttackTime + getAttackIntervalMS(entity);
}
