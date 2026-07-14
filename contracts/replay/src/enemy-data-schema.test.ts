import { expect, test } from 'bun:test';
import { EnemyDataSchema } from './enemy-data-schema';

test('it accepts a well-formed enemy', () => {
  const result = EnemyDataSchema.safeParse({
    level: 1,
    life: 30,
    name: 'Test Enemy',
    primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
    xp: 10,
  });

  expect(result.success).toBeTrue();
});

test('it rejects an enemy with a malformed attack', () => {
  const result = EnemyDataSchema.safeParse({
    level: 1,
    life: 30,
    name: 'Test Enemy',
    primaryAttack: { speed: 0.5 },
    xp: 10,
  });

  expect(result.success).toBeFalse();
});
