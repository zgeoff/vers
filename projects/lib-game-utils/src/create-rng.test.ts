import { expect, test } from 'bun:test';
import { createRNG } from './create-rng';

test('it generates a deterministic sequence of integers with the given seed', () => {
  const rng = createRNG(35_131_234);

  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`33`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`42`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`31`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`100`);
  expect(rng.getInt(0, 100)).toMatchInlineSnapshot(`76`);
});

test('it generates a deterministic array of integers with the given seed', () => {
  const rng = createRNG(35_131_234);

  const series = rng.getSeries(0, 100, 20);

  expect(series).toHaveLength(20);
  expect(series).toSatisfyAll((value: number) => typeof value === 'number');
});
