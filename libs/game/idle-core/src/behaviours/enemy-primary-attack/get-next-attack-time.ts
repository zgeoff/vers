import type { Enemy, EnemyPrimaryAttackBehaviourState } from '../../types';
import { getAttackIntervalMS } from './get-attack-interval-ms';

export function getNextAttackTime(entity: Enemy, state: EnemyPrimaryAttackBehaviourState): number {
  return state.lastAttackTime + getAttackIntervalMS(entity);
}
