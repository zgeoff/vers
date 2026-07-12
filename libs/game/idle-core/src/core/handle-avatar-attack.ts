import type { Activity, Avatar, AvatarAttackEvent } from '../types';
import { createLogLabel } from '../utils/create-log-label';
import { logger } from '../utils/logger';

export function handleAvatarAttack(_event: AvatarAttackEvent, avatar: Avatar, activity: Activity) {
  const label = createLogLabel('avatar', avatar.id);

  // find the first enemy that is alive
  const enemy = activity.currentWave?.nextLivingEnemy;

  if (enemy) {
    const damage = avatar.calcAttackDamage();

    logger.debug(`${label} --> ${damage} damage to ${enemy.id}`);
    enemy.receiveDamage(damage);
  }
}
