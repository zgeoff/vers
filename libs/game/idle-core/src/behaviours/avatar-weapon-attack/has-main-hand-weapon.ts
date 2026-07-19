import type { Avatar } from '../../types';

export function hasMainHandWeapon(entity: Avatar): boolean {
  return entity.mainHandEquipment !== null;
}
