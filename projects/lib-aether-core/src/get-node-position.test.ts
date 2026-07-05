import { expect, test } from 'vitest';
import { getNodePosition } from './get-node-position';

test('it returns [0, 0] for the origin node', () => {
  expect(getNodePosition(0, 0)).toStrictEqual([0, 0]);
});

// first difficulty level (radius = 1)
// 4 segments, so angles are 0, 90, 180, 270 degrees
test.each([
  { difficulty: 1, expected: [1, 0], index: 0 },
  { difficulty: 1, expected: [0, 1], index: 1 },
  { difficulty: 1, expected: [-1, 0], index: 2 },
  { difficulty: 1, expected: [0, -1], index: 3 },
])('it returns $expected for node at index $index difficulty $difficulty', (data) => {
  expect(getNodePosition(data.index, data.difficulty)).toStrictEqual(data.expected);
});

// second difficulty level (radius = 2)
// 8 segments, so angles are 0, 45, 90, 135, 180, 225, 270, 315 degrees
/* oxlint-disable oxc/approx-constant -- 1.414 is the implementation's own toFixed(3)-rounded output, not an approximation of Math.SQRT2 */
test.each([
  { difficulty: 2, expected: [2, 0], index: 0 },
  { difficulty: 2, expected: [1.414, 1.414], index: 1 },
  { difficulty: 2, expected: [0, 2], index: 2 },
  { difficulty: 2, expected: [-1.414, 1.414], index: 3 },
  { difficulty: 2, expected: [-2, 0], index: 4 },
  { difficulty: 2, expected: [-1.414, -1.414], index: 5 },
  { difficulty: 2, expected: [0, -2], index: 6 },
  { difficulty: 2, expected: [1.414, -1.414], index: 7 },
])('it returns $expected for node at index $index difficulty $difficulty', (data) => {
  expect(getNodePosition(data.index, data.difficulty)).toStrictEqual(data.expected);
});

/* oxlint-enable oxc/approx-constant */

test('it returns coordinates with 3 decimal places of precision', () => {
  const [x, y] = getNodePosition(1, 2);

  expect(x.toString()).toMatch(/^-?\d+\.\d{3}$/);
  expect(y.toString()).toMatch(/^-?\d+\.\d{3}$/);
});
