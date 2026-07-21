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
  const firstSeries = Array.from({ length: 10 }, () => first.getInt(0, 100));
  const secondSeries = Array.from({ length: 10 }, () => second.getInt(0, 100));

  expect(firstSeries).toStrictEqual(secondSeries);

  expect(firstSeries).toMatchInlineSnapshot(`
    [
      84,
      62,
      70,
      32,
      71,
      53,
      23,
      79,
      60,
      34,
    ]
  `);
});

test('it scrambles seed zero to a valid non-zero state', () => {
  expect(buildStateFromSeed(0)).not.toBe('0'.repeat(32));
  expect(() => createRNG(buildStateFromSeed(0))).not.toThrow();
});
