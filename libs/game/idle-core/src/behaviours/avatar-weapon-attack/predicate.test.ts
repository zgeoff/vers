import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { EquipmentSlot } from '../../types';
import { predicate } from './predicate';

test('it returns true when avatar has a main hand weapon', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Test Weapon',
        speed: 1,
      },
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const result = predicate(avatar);

  expect(result).toBeTrue();
});

test('it returns false when avatar has no main hand weapon', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: null,
    },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const result = predicate(avatar);

  expect(result).toBeFalse();
});
