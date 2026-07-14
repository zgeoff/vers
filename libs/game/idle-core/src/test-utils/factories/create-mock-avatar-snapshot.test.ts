import { expect, test } from 'bun:test';
import { EntityStatus } from '../../types';
import { createMockAvatarSnapshot } from './create-mock-avatar-snapshot';

test('it creates an avatar snapshot with expected properties', () => {
  const avatar = createMockAvatarSnapshot();

  expect(avatar).toStrictEqual({
    behaviours: {},
    id: expect.toBeString(),
    isAlive: true,
    level: 1,
    life: 100,
    mainHandAttack: null,
    maxLife: 100,
    name: 'Test Avatar',
    status: EntityStatus.Alive,
  });
});

test('it creates an avatar snapshot with custom properties', () => {
  const avatar = createMockAvatarSnapshot({
    behaviours: { avatar_weapon_attack: { lastAttackTime: 500 } },
    id: 'avatar-1',
    isAlive: false,
    level: 5,
    life: 40,
    mainHandAttack: { maxDamage: 10, minDamage: 5, speed: 1 },
    maxLife: 120,
    name: 'Custom Avatar',
    status: EntityStatus.Dead,
  });

  expect(avatar).toStrictEqual({
    behaviours: { avatar_weapon_attack: { lastAttackTime: 500 } },
    id: 'avatar-1',
    isAlive: false,
    level: 5,
    life: 40,
    mainHandAttack: { maxDamage: 10, minDamage: 5, speed: 1 },
    maxLife: 120,
    name: 'Custom Avatar',
    status: EntityStatus.Dead,
  });
});
