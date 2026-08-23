import { expect, test } from 'bun:test';
import { isNodeRevealed } from './is-node-revealed';
import { toNodeID } from './to-node-id';

test('it reveals the coordinate a source sits on', () => {
  expect(isNodeRevealed([{ coord: [5, -3], radius: 2 }], toNodeID(5, -3))).toBe(true);
});

test('it reveals a node inside the source disc', () => {
  expect(isNodeRevealed([{ coord: [0, 0], radius: 2 }], toNodeID(1, 1))).toBe(true);
});

test('it reveals a node exactly on the disc edge', () => {
  expect(isNodeRevealed([{ coord: [0, 0], radius: 2 }], toNodeID(2, 0))).toBe(true);
});

test('it hides a node one hop past the disc edge', () => {
  expect(isNodeRevealed([{ coord: [0, 0], radius: 2 }], toNodeID(3, 0))).toBe(false);
});

test('it reveals a node covered only by the second of two discs', () => {
  const sources = [
    { coord: [0, 0], radius: 1 },
    { coord: [10, 0], radius: 1 },
  ] as const;

  expect(isNodeRevealed(sources, toNodeID(10, 1))).toBe(true);
});

test('it hides every node when no source is given', () => {
  expect(isNodeRevealed([], toNodeID(0, 0))).toBe(false);
});

test('it hides an id that names no addressable cell', () => {
  expect(isNodeRevealed([{ coord: [0, 0], radius: 2 }], 'not_a_node_id')).toBe(false);
});
