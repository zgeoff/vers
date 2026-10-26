import { expect, test } from 'bun:test';
import { buildPercentile } from './build-percentile';

test.each([
  [0.5, 3],
  [0.95, 5],
  [0, 1],
  [1, 5],
])('it takes the nearest-rank %d percentile of an unsorted set as %d', (quantile, expected) => {
  expect(buildPercentile([5, 1, 4, 2, 3], quantile)).toBe(expected);
});

test('it reads an empty set as zero', () => {
  expect(buildPercentile([], 0.95)).toBe(0);
});
