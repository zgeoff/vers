import type { Avatar } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function predicate(entity: Avatar): boolean {
  // TODO: verify main hand is actually a weapon
  return entity.mainHandEquipment !== null;
}
