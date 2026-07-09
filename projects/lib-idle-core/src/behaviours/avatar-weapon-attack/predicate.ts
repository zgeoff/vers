import type { Avatar } from '../../types';

export function predicate(entity: Avatar): boolean {
  // TODO: verify main hand is actually a weapon
  return entity.mainHandEquipment !== null;
}
