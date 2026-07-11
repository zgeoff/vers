import { expect, test } from 'bun:test';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { EquipmentSlot } from '../../types';
import { createAvatar } from '../create-avatar';
import { calcAvatarAttackDamage } from './calc-avatar-attack-damage';

test('it calculates the damage for an avatar attack', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 10,
        name: 'Test Weapon',
        speed: 1,
      },
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const damage = calcAvatarAttackDamage(avatar, ctx);

  expect(damage).toBe(10);
});
