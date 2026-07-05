import type { CombatExecutor, Enemy, EnemyPrimaryAttackBehaviour } from '../../types';
import { createLogLabel } from '../../utils/create-log-label';
import { logger } from '../../utils/logger';
import { createEnemyAttackEvent } from './create-enemy-attack-event';
import { getNextAttackTime } from './get-next-attack-time';
import { isAttackReady } from './is-attack-ready';

export function handleTick(
  entity: Enemy,
  behaviour: EnemyPrimaryAttackBehaviour,
  executor: CombatExecutor,
): void {
  const label = createLogLabel('enemy', entity.id);

  // loop to allow high APS to function correctly w/ server simulation batching
  while (isAttackReady(entity, behaviour.state, executor)) {
    const time = getNextAttackTime(entity, behaviour.state);
    const event = createEnemyAttackEvent(entity, time);

    executor.scheduleEvent(event);

    behaviour.setState((draftState) => {
      draftState.lastAttackTime = time;
    });

    logger.debug(`${label} scheduled attack at ${event.time}`);
  }
}
