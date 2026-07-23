import { expect, test } from 'bun:test';
import { MAX_DIFFICULTY } from './consts';
import { getDifficulty } from './get-difficulty';

test('it is zero at the origin', () => {
  expect(getDifficulty(0, 0)).toBe(0);
});

test('it climbs one step per ring out from the origin', () => {
  expect(getDifficulty(1, 0)).toBe(1);
  expect(getDifficulty(3, 0)).toBe(3);
  expect(getDifficulty(0, -4)).toBe(4);
});

test('it plateaus at the cap for a far cell', () => {
  expect(getDifficulty(1000, 0)).toBe(MAX_DIFFICULTY);
});

test('it treats direction symmetrically', () => {
  expect(getDifficulty(6, 0)).toBe(getDifficulty(-6, 0));
});
