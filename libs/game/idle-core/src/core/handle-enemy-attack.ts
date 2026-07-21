import type { Activity, Avatar, EnemyAttackEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';

export function handleEnemyAttack(event: EnemyAttackEvent, avatar: Avatar, activity: Activity) {
  const enemy = activity.currentWave?.enemies.find((candidate) => candidate.id === event.source);

  if (enemy?.isAlive === true && avatar.isAlive) {
    const damage = enemy.rollAttackDamage();

    logger.debug(
      () => `${createLogLabel('enemy', event.source)} --> ${damage} damage to ${avatar.id}`,
    );

    avatar.receiveDamage(damage);
  }
}
