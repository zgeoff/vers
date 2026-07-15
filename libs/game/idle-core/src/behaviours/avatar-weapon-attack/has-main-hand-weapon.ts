import type { Avatar } from '../../types';

export function hasMainHandWeapon(entity: Avatar): boolean {
  // TODO: verify main hand is actually a weapon
  return entity.mainHandEquipment !== null;
}
