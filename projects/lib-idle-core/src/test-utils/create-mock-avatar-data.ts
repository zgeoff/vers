import { createId } from '@paralleldrive/cuid2';
import { Class } from '@vers/data';
import type { AvatarData } from '../types';
import { EquipmentSlot } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createMockAvatarData(overrides: Partial<AvatarData> = {}): AvatarData {
  const avatar: AvatarData = {
    class: Class.Brute,
    id: createId(),
    level: 1,
    life: 200,
    name: 'Test Avatar',
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
