import type { EnemyPrimaryAttackBehaviourState } from '../../types';

export function getInitialState(): EnemyPrimaryAttackBehaviourState {
  return {
    lastAttackTime: 0,
  };
}
