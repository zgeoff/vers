import { expect, test } from 'bun:test';
import { buildMaximum } from './build-maximum';

test('it takes the largest value', () => {
  expect(buildMaximum([3, 9, 4])).toBe(9);
});

test('it reads an empty set as zero', () => {
  expect(buildMaximum([])).toBe(0);
});

test('it takes the maximum of more values than a call can spread', () => {
  const values = Array.from({ length: 1_000_000 }, (_, index) => index);

  expect(buildMaximum(values)).toBe(999_999);
});
