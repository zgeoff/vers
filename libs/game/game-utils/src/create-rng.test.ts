import { expect, test } from 'bun:test';
import { createRNG, stateFromSeed } from './create-rng';

test('it generates a deterministic sequence of integers with the given seed', () => {
  const rng = createRNG(stateFromSeed(35_131_234));

  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`42`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`31`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`100`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`76`);
});

test('it generates a deterministic array of integers with the given seed', () => {
  const rng = createRNG(stateFromSeed(35_131_234));
  const series = rng.getSeries(0, 100, 20);

  expect(series).toHaveLength(20);
  expect(series).toSatisfyAll((value: number) => typeof value === 'number');
});

test('it round-trips a snapshotted state back to the identical string', () => {
  const rng = createRNG(stateFromSeed(1234));

  rng.getInt(0, 100);
  rng.getInt(0, 100);

  const snapshot = rng.getState();

  expect(createRNG(snapshot).getState()).toBe(snapshot);
});

test('it resumes a mid-stream snapshot with the exact subsequent draw sequence', () => {
  const original = createRNG(stateFromSeed(4_242_424_242));

  original.getInt(0, 1000);
  original.getInt(0, 1000);

  const midStreamState = original.getState();
  const expectedContinuation = original.getSeries(0, 1000, 10);
  const resumed = createRNG(midStreamState);
  const actualContinuation = resumed.getSeries(0, 1000, 10);

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

test('it derives a deterministic state from a numeric seed', () => {
  expect(stateFromSeed(999)).toBe(stateFromSeed(999));
  expect(stateFromSeed(999)).not.toBe(stateFromSeed(1000));
});

test('it produces a reproducible draw sequence from a seed-derived state', () => {
  const first = createRNG(stateFromSeed(555));
  const second = createRNG(stateFromSeed(555));

  expect(first.getSeries(0, 100, 10)).toStrictEqual(second.getSeries(0, 100, 10));
});
