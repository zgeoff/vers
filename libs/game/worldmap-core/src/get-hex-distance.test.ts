import { expect, test } from 'bun:test';
import { getHexDistance } from './get-hex-distance';

test('it is zero for a cell against itself', () => {
  expect(getHexDistance([4, -2], [4, -2])).toBe(0);
});

test('it is one for every adjacent cell', () => {
  const neighbours: Array<[number, number]> = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];

  for (const neighbour of neighbours) {
    expect(getHexDistance([0, 0], neighbour)).toBe(1);
  }
});

test('it is symmetric', () => {
  expect(getHexDistance([2, 3], [-1, 5])).toBe(getHexDistance([-1, 5], [2, 3]));
});

test('it counts rings straight out one axis', () => {
  expect(getHexDistance([0, 0], [5, 0])).toBe(5);
  expect(getHexDistance([0, 0], [0, -5])).toBe(5);
});
