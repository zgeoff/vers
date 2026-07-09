import { expect, test } from 'bun:test';
import { getCompressedAetherGraph } from './get-compressed-aether-graph';
import type { AetherNode } from './types';

test('it compresses an array of aether nodes', () => {
  const nodes: Array<AetherNode> = [
    {
      connections: [null, null, null, null],
      difficulty: 0,
      id: 'node1',
      index: 0,
      position: [0, 0],
      seed: 123_456,
    },
    {
      connections: ['node1', null, null, null],
      difficulty: 1,
      id: 'node2',
      index: 0,
      position: [1, 0],
      seed: 789_012,
    },
  ];

  const result = getCompressedAetherGraph(nodes);

  // Should return an array with the same length
  expect(result).toStrictEqual([
    {
      c: [null, null, null, null],
      d: 0,
      i: 0,
      id: 'node1',
      p: [0, 0],
      s: 123_456,
    },
    {
      c: ['node1', null, null, null],
      d: 1,
      i: 0,
      id: 'node2',
      p: [1, 0],
      s: 789_012,
    },
  ]);
});
