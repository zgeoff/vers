import { expect, test } from 'bun:test';
import { findEdgeNeighbourID } from './find-edge-neighbour-id';

test('it returns the second endpoint when the node is the first', () => {
  const edge = { endPosition: [1, 0], id: '0_0|1_0', startPosition: [0, 0] } as const;

  expect(findEdgeNeighbourID(edge, '0_0')).toBe('1_0');
});

test('it returns the first endpoint when the node is the second', () => {
  const edge = { endPosition: [1, 0], id: '0_0|1_0', startPosition: [0, 0] } as const;

  expect(findEdgeNeighbourID(edge, '1_0')).toBe('0_0');
});

test('it misses when the node is neither endpoint', () => {
  const edge = { endPosition: [1, 0], id: '0_0|1_0', startPosition: [0, 0] } as const;

  expect(findEdgeNeighbourID(edge, '5_5')).toBeUndefined();
});
