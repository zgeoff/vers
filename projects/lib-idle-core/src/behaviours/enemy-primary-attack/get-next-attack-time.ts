import type { Enemy, EnemyPrimaryAttackBehaviourState } from '../../types';
import { getAttackIntervalMS } from './get-attack-interval-ms';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getNextAttackTime(entity: Enemy, state: EnemyPrimaryAttackBehaviourState): number {
  return state.lastAttackTime + getAttackIntervalMS(entity);
}
