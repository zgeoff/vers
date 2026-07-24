import { expect, test } from 'bun:test';
import { toNodeID } from './to-node-id';

test('it encodes a coordinate as an underscore-joined id', () => {
  expect(toNodeID(3, 7)).toBe('3_7');
});

test('it preserves negative coordinates', () => {
  expect(toNodeID(-4, -9)).toBe('-4_-9');
});

test('it encodes the origin', () => {
  expect(toNodeID(0, 0)).toBe('0_0');
});
