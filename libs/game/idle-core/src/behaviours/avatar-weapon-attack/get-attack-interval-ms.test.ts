import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { EquipmentSlot } from '../../types';
import { getAttackIntervalMS } from './get-attack-interval-ms';

test('it calculates the weapons attack interval', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Slow Weapon',
        speed: 0.55,
      },
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const interval = getAttackIntervalMS(avatar);

  expect(interval).toBe(1818); // 1000ms / 0.55 = 1818ms
});
