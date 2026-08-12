import { expect, test } from 'bun:test';
import { buildRevealDistanceField } from './build-reveal-distance-field';

test('it reads 0 over a disc and 1 past its falloff', () => {
  const field = buildRevealDistanceField(
    [{ coord: [0, 0], radius: 1 }],
    { maxCX: 4, maxCY: 4, minCX: -4, minCY: -4 },
    { falloff: 2, resolution: 1 },
  );

  expect(field.cols).toBe(9);
  expect(field.rows).toBe(9);

  // the source cell sits inside its own clear radius; the far corner is well past clear + falloff
  expect(field.values[4 * 9 + 4]).toBe(0);
  expect(field.values[0]).toBe(1);
});

test('it eases density monotonically outward from a disc', () => {
  const field = buildRevealDistanceField(
    [{ coord: [0, 0], radius: 1 }],
    { maxCX: 6, maxCY: 0, minCX: -6, minCY: 0 },
    { falloff: 3, resolution: 1 },
  );

  // density along the half-row leading away from the disc never decreases: the tail equals its
  // own ascending sort
  const tail = [...field.values].slice(Math.floor(field.values.length / 2));

  expect(field.rows).toBe(1);
  expect(tail).toStrictEqual([...tail].toSorted((a, b) => a - b));
});

test('it produces the same field for the same input', () => {
  const sources = [
    { coord: [0, 0] as const, radius: 2 },
    { coord: [3, 1] as const, radius: 2 },
  ];

  const viewport = { maxCX: 4, maxCY: 4, minCX: -4, minCY: -4 };

  expect(buildRevealDistanceField(sources, viewport, { falloff: 3, resolution: 2 })).toStrictEqual(
    buildRevealDistanceField(sources, viewport, { falloff: 3, resolution: 2 }),
  );
});

test('it saturates the whole field when no disc reaches the viewport', () => {
  const field = buildRevealDistanceField(
    [{ coord: [100, 100], radius: 1 }],
    { maxCX: 1, maxCY: 1, minCX: 0, minCY: 0 },
    { falloff: 2, resolution: 1 },
  );

  expect([...field.values]).toStrictEqual([1, 1, 1, 1]);
});

test('it renders the union of overlapping discs without a seam between them', () => {
  const field = buildRevealDistanceField(
    [
      { coord: [-1, 0], radius: 1 },
      { coord: [1, 0], radius: 1 },
    ],
    { maxCX: 2, maxCY: 0, minCX: -2, minCY: 0 },
    { falloff: 2, resolution: 1 },
  );

  // every sample on the row between the two disc centers sits inside the union's clear region
  expect([...field.values]).toStrictEqual([0, 0, 0, 0, 0]);
});
