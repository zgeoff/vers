import { expect, test } from 'bun:test';
import { buildCoordHashUnit } from './build-coord-hash';
import { buildValueNoise } from './build-value-noise';

test('it returns the same value for the same inputs', () => {
  expect(buildValueNoise(42, 3.7, -1.2, 8)).toBe(buildValueNoise(42, 3.7, -1.2, 8));
});

test('it maps to the half-open unit interval', () => {
  for (let i = 0; i < 25; i++) {
    const value = buildValueNoise(7, i * 0.37, i * -0.61, 8);

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});

test('it agrees with the lattice hash exactly on an integer coordinate', () => {
  expect(buildValueNoise(7, 4, -2, 8)).toBe(buildCoordHashUnit(7, 4, -2, 8));
});

test('it interpolates linearly along an axis between two lattice points', () => {
  const left = buildCoordHashUnit(7, 4, 0, 8);
  const right = buildCoordHashUnit(7, 5, 0, 8);

  expect(buildValueNoise(7, 4.25, 0, 8)).toBeCloseTo(left + (right - left) * 0.25, 10);
});

test('it decorrelates the draw channel from other noise fields', () => {
  expect(buildValueNoise(7, 1.5, 2.5, 8)).not.toBe(buildValueNoise(7, 1.5, 2.5, 9));
});

test('it moves with the avatar seed', () => {
  expect(buildValueNoise(1, 5.5, 5.5, 8)).not.toBe(buildValueNoise(2, 5.5, 5.5, 8));
});

test('it draws a stable value for a fixed seed', () => {
  expect(buildValueNoise(11, 3.25, -6.75, 8)).toMatchInlineSnapshot(`0.6368300538742915`);
});
