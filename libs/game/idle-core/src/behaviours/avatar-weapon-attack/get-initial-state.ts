import type { AvatarWeaponAttackBehaviourState } from '../../types';

export function getInitialState(): AvatarWeaponAttackBehaviourState {
  return {
    lastAttackTime: 0,
  };
}
