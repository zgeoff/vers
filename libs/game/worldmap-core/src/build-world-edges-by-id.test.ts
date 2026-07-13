import { expect, test } from 'bun:test';
import { buildWorldEdgesByID } from './build-world-edges-by-id';
import type { WorldMapNodesByID } from './types';

test('it creates an edge map from a valid node map', () => {
  const nodeMap: WorldMapNodesByID = {
    node1: {
      connections: ['node2', null, null, null],
      difficulty: 0,
      id: 'node1',
      index: 0,
      position: [0, 0],
      seed: 123_456,
    },
    node2: {
      connections: ['node1', 'node3', null, null],
      difficulty: 1,
      id: 'node2',
      index: 0,
      position: [1, 0],
      seed: 789_012,
    },
    node3: {
      connections: ['node2', null, null, null],
      difficulty: 1,
      id: 'node3',
      index: 1,
      position: [0, 1],
      seed: 345_678,
    },
  };

  const edgeMap = buildWorldEdgesByID(nodeMap);

  expect(edgeMap).toStrictEqual({
    'node1:node2': {
      end: [0, 0],
      id: 'node1:node2',
      start: [1, 0],
    },
    'node2:node3': {
      end: [1, 0],
      id: 'node2:node3',
      start: [0, 1],
    },
  });
});
