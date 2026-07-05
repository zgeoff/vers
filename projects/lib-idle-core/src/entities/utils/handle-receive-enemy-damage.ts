import { EntityStatus } from '../../types';
import type { Enemy } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- entities are mutated in place by the tick loop
export function handleReceiveEnemyDamage(amount: number, entity: Enemy): void {
  // prevent negative life
  const newLife = Math.max(entity.life - amount, 0);

  entity.setState((draftState) => {
    draftState.life = newLife;

    if (newLife <= 0) {
      draftState.status = EntityStatus.Dead;
    }
  });
}
