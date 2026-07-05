import { EntityStatus } from '../../types';
import type { Avatar } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- entities are mutated in place by the tick loop
export function handleReceiveAvatarDamage(amount: number, entity: Avatar): void {
  // prevent negative life
  const newLife = Math.max(entity.life - amount, 0);

  entity.setState((draftState) => {
    draftState.life = newLife;

    if (newLife <= 0) {
      draftState.status = EntityStatus.Dead;
    }
  });
}
