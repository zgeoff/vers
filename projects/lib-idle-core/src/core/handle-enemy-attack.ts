import type { Activity, Avatar, EnemyAttackEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- avatar is mutated in place via receiveDamage during the tick loop
export function handleEnemyAttack(event: EnemyAttackEvent, avatar: Avatar, activity: Activity) {
  const enemy = activity.currentEnemyGroup?.enemies.find(
    (candidate) => candidate.id === event.source,
  );

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (enemy?.isAlive && avatar.isAlive) {
    const label = createLogLabel('enemy', event.source);

    const damage = enemy.calcAttackDamage();

    logger.debug(`${label} --> ${damage} damage to ${avatar.id}`);

    avatar.receiveDamage(damage);
  }
}
