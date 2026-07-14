import { expect, test } from 'bun:test';
import { EntityStatus } from '../../types';
import { createMockEnemySnapshot } from './create-mock-enemy-snapshot';

test('it creates an enemy snapshot with expected properties', () => {
  const enemy = createMockEnemySnapshot();

  expect(enemy).toStrictEqual({
    behaviours: {},
    id: expect.toBeString(),
    isAlive: true,
    level: 1,
    life: 30,
    maxLife: 30,
    name: 'Test Enemy',
    primaryAttack: {
      maxDamage: 3,
      minDamage: 1,
      speed: 0.5,
    },
    status: EntityStatus.Alive,
  });
});

test('it creates an enemy snapshot with custom properties', () => {
  const enemy = createMockEnemySnapshot({
    behaviours: { enemy_primary_attack: { lastAttackTime: 500 } },
    id: 'enemy-1',
    isAlive: false,
    level: 2,
    life: 0,
    maxLife: 30,
    name: 'Custom Enemy',
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    status: EntityStatus.Dead,
  });

  expect(enemy).toStrictEqual({
    behaviours: { enemy_primary_attack: { lastAttackTime: 500 } },
    id: 'enemy-1',
    isAlive: false,
    level: 2,
    life: 0,
    maxLife: 30,
    name: 'Custom Enemy',
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    status: EntityStatus.Dead,
  });
});
