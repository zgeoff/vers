import { expect, test } from 'bun:test';
import { buildRevealDistanceField } from './build-reveal-distance-field';
import { encodeMortonKey } from './encode-morton-key';

test('it eases density from 0 over a revealed cell to 1 at falloff distance', () => {
  const field = buildRevealDistanceField(
    [encodeMortonKey([0, 0])],
    {
      maxCX: 2,
      maxCY: 2,
      minCX: -2,
      minCY: -2,
    },
    2,
  );

  expect(field.cols).toBe(5);
  expect(field.rows).toBe(5);

  // the revealed center reads 0, its six axial neighbours ease to smoothstep(1/2) = 0.5, and
  // everything two or more hops out saturates at 1
  expect(field.values[2 * 5 + 2]).toBe(0);
  expect(field.values[2 * 5 + 3]).toBe(0.5);
  expect(field.values[3 * 5 + 2]).toBe(0.5);
  expect(field.values[3 * 5 + 1]).toBe(0.5);
  expect(field.values[0]).toBe(1);

  expect([...field.values]).toMatchInlineSnapshot(`
    [
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0.5,
      0.5,
      1,
      1,
      0.5,
      0,
      0.5,
      1,
      1,
      0.5,
      0.5,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
    ]
  `);
});

test('it produces the same field for the same input', () => {
  const cells = [encodeMortonKey([0, 0]), encodeMortonKey([1, 0])];
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  expect(buildRevealDistanceField(cells, viewport, 2)).toStrictEqual(
    buildRevealDistanceField(cells, viewport, 2),
  );
});

test('it saturates the whole field when nothing is revealed', () => {
  const field = buildRevealDistanceField([], { maxCX: 1, maxCY: 1, minCX: 0, minCY: 0 }, 2);

  expect([...field.values]).toStrictEqual([1, 1, 1, 1]);
});

test('it zeroes the whole field when everything is revealed', () => {
  const cells = [
    encodeMortonKey([0, 0]),
    encodeMortonKey([0, 1]),
    encodeMortonKey([1, 0]),
    encodeMortonKey([1, 1]),
  ];

  const field = buildRevealDistanceField(cells, { maxCX: 1, maxCY: 1, minCX: 0, minCY: 0 }, 2);

  expect([...field.values]).toStrictEqual([0, 0, 0, 0]);
});
