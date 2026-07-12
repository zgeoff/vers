import { expect, test } from 'bun:test';
import { EquipmentSlot } from '../types';
import { createMockAvatarData } from './create-mock-avatar-data';

test('it creates avatar data with expected properties', () => {
  const avatar = createMockAvatarData();

  expect(avatar).toStrictEqual({
    id: expect.toBeString(),
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: expect.toBeString(),
        maxDamage: 20,
        minDamage: 10,
        name: 'Bloodthirst Blade, Bastard Sword',
        speed: 0.8,
      },
    },
  });
});

test('it creates avatar data with custom properties', () => {
  const avatar = createMockAvatarData({
    id: 'test-id',
    level: 2,
    life: 100,
    name: 'Test Avatar 2',
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

  expect(avatar).toStrictEqual({
    id: 'test-id',
    level: 2,
    life: 100,
    name: 'Test Avatar 2',
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
});
