import { expect, test } from 'bun:test';
import { toHexPosition } from './to-hex-position';

test('it places the origin cell at the scene origin', () => {
  expect(toHexPosition(0, 0)).toStrictEqual([0, 0]);
});

test('it spaces adjacent cells one row apart vertically', () => {
  const [, y] = toHexPosition(0, 1);

  expect(y).toBeCloseTo(1.5);
});

test('it produces stable lattice centers', () => {
  const centers = [
    toHexPosition(1, 0),
    toHexPosition(0, 1),
    toHexPosition(2, -1),
    toHexPosition(-3, 2),
  ];

  expect(centers).toMatchInlineSnapshot(`
    [
      [
        1.7320508075688772,
        0,
      ],
      [
        0.8660254037844386,
        1.5,
      ],
      [
        2.598076211353316,
        -1.5,
      ],
      [
        -3.4641016151377544,
        3,
      ],
    ]
  `);
});
