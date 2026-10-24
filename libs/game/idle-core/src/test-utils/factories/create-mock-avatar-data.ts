import { createId } from '@paralleldrive/cuid2';
import type { AvatarData } from '../../types';
import { EquipmentSlot } from '../../types';

export function createMockAvatarData(overrides: Partial<AvatarData> = {}): AvatarData {
  const avatar: AvatarData = {
    id: createId(),
    level: 1,
    life: 200,
    name: 'Test Avatar',
    xp: 0,
    ...overrides,
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: createId(),
        maxDamage: 20,
        minDamage: 10,
        name: 'Bloodthirst Blade, Bastard Sword',
        speedPerMille: 800,
      },
      ...overrides.paperdoll,
    },
  };

  return avatar;
}
