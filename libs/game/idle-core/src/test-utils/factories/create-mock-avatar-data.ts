import { createId } from '@paralleldrive/cuid2';
import type { AvatarData } from '../../types';
import { EquipmentSlot } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Partial of the mutable avatar seed, whose nested paperdoll has no readonly form; spread into the returned seed, never mutated
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

        // weapon has a speed of 0.8 attacks per second === 1.25s interval
        speed: 0.8,
      },
      ...overrides.paperdoll,
    },
  };

  return avatar;
}
