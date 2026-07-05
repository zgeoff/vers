import { type Enemy, EntityStatus } from '../../types';

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
