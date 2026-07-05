import type { Avatar, AvatarWeaponAttackBehaviourState } from '../../types';
import { getAttackIntervalMS } from './get-attack-interval-ms';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getNextAttackTime(entity: Avatar, state: AvatarWeaponAttackBehaviourState): number {
  return state.lastAttackTime + getAttackIntervalMS(entity);
}
