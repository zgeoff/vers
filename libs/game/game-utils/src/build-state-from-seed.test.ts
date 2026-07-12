import { expect, test } from 'bun:test';
import { buildStateFromSeed } from './build-state-from-seed';
import { createRNG } from './create-rng';

test('it derives a deterministic state from a numeric seed', () => {
  expect(buildStateFromSeed(999)).toBe(buildStateFromSeed(999));
  expect(buildStateFromSeed(999)).not.toBe(buildStateFromSeed(1000));
});

test('it produces a reproducible draw sequence from a seed-derived state', () => {
  const first = createRNG(buildStateFromSeed(555));
  const second = createRNG(buildStateFromSeed(555));

  expect(first.getSeries(0, 100, 10)).toStrictEqual(second.getSeries(0, 100, 10));
});

test('it scrambles seed zero to a valid non-zero state', () => {
  expect(buildStateFromSeed(0)).not.toBe('0'.repeat(32));
  expect(() => createRNG(buildStateFromSeed(0))).not.toThrow();
});
