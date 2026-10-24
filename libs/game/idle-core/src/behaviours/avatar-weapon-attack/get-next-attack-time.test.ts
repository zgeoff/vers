import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { EquipmentSlot } from '../../types';
import { getNextAttackTime } from './get-next-attack-time';

test('it calculates the next attack time', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Test Weapon',

        // 1 attack per second = 1000ms interval
        speedPerMille: 1000,
      },
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const state = { lastAttackTime: 1000 };
  const nextAttackTime = getNextAttackTime(avatar, state);

  // 1000 + 1000
  expect(nextAttackTime).toBe(2000);
});
