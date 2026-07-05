import { Class } from '@vers/data';
import { expect, test } from 'vitest';
import { EquipmentSlot } from '../types';
import { createMockAvatarData } from './create-mock-avatar-data';

test('it creates avatar data with expected properties', () => {
  const avatar = createMockAvatarData();

  expect(avatar).toStrictEqual({
    class: Class.Brute,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
        id: expect.any(String),
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
    class: Class.Scholar,
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
    class: Class.Scholar,
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
