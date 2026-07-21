import type { Activity, Avatar, AvatarAttackEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';

export function handleAvatarAttack(_event: AvatarAttackEvent, avatar: Avatar, activity: Activity) {
  const enemy = activity.currentWave?.nextLivingEnemy;

  if (enemy) {
    const damage = avatar.rollAttackDamage();

    logger.debug(
      () => `${createLogLabel('avatar', avatar.id)} --> ${damage} damage to ${enemy.id}`,
    );

    enemy.receiveDamage(damage);
  }
}
