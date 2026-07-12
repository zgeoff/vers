import { expect, test } from 'bun:test';
import { buildKillXP } from './build-kill-xp';

test('it returns the enemy base xp at a difficulty of one', () => {
  expect(buildKillXP({ xp: 42 }, 1)).toBe(42);
});

test('it scales up with difficulty', () => {
  const higher = buildKillXP({ xp: 100 }, 2);
  const lower = buildKillXP({ xp: 100 }, 1);

  expect(higher).toBeGreaterThan(lower);
});

test('it never returns negative xp for a non-negative difficulty', () => {
  expect(buildKillXP({ xp: 10 }, 0)).toBeGreaterThanOrEqual(0);
});
