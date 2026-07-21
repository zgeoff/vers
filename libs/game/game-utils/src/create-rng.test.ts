import { expect, test } from 'bun:test';
import { buildStateFromSeed } from './build-state-from-seed';
import { createRNG } from './create-rng';

test('it generates a deterministic sequence of integers with the given seed', () => {
  const rng = createRNG(buildStateFromSeed(35_131_234));

  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`42`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`31`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`100`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`76`);
});

test('it generates a deterministic array of integers with the given seed', () => {
  const rng = createRNG(buildStateFromSeed(35_131_234));
  const series = Array.from({ length: 20 }, () => rng.getInt(0, 100));

  expect(series).toMatchInlineSnapshot(`
    [
      33,
      33,
      42,
      31,
      100,
      76,
      47,
      95,
      23,
      43,
      28,
      65,
      95,
      67,
      35,
      18,
      90,
      0,
      34,
      65,
    ]
  `);
});

test('it round-trips a snapshotted state back to the identical string', () => {
  const rng = createRNG(buildStateFromSeed(1234));

  rng.getInt(0, 100);
  rng.getInt(0, 100);

  const snapshot = rng.getState();

  expect(createRNG(snapshot).getState()).toBe(snapshot);
});

test('it resumes a mid-stream snapshot with the exact subsequent draw sequence', () => {
  const original = createRNG(buildStateFromSeed(4_242_424_242));

  original.getInt(0, 1000);
  original.getInt(0, 1000);

  const midStreamState = original.getState();
  const expectedContinuation = Array.from({ length: 10 }, () => original.getInt(0, 1000));
  const resumed = createRNG(midStreamState);
  const actualContinuation = Array.from({ length: 10 }, () => resumed.getInt(0, 1000));

  expect(actualContinuation).toStrictEqual(expectedContinuation);
});

test('it rejects an all-zero state', () => {
  expect(() => createRNG('0'.repeat(32))).toThrow();
});

test('it rejects a state of the wrong length', () => {
  expect(() => createRNG('abcd')).toThrow();
});

test('it rejects a non-hex state', () => {
  expect(() => createRNG('z'.repeat(32))).toThrow();
});
