import { EntityStatus } from '../../types';
import type { Enemy } from '../../types';

export function handleReceiveEnemyDamage(amount: number, entity: Enemy): void {
  const newLife = Math.max(entity.life - amount, 0);

  entity.setState((draftState) => {
    draftState.life = newLife;

    if (newLife <= 0) {
      draftState.status = EntityStatus.Dead;
    }
  });
}
