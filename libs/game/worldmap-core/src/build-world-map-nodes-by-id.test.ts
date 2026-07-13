import { expect, spyOn, test } from 'bun:test';
import { buildWorldMapNodesByID } from './build-world-map-nodes-by-id';
import * as getRandomizedPosition from './get-randomized-position';
import type { CompressedWorldMapNode } from './types';

test('it creates a node map from compressed nodes', () => {
  // mock our randomization so we can assert we're getting the correct positions
  spyOn(getRandomizedPosition, 'getRandomizedPosition').mockImplementation((position) => [
    ...position,
  ]);

  const compressedNodes: Array<CompressedWorldMapNode> = [
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
  ];

  const nodeMap = buildWorldMapNodesByID(compressedNodes);

  expect(nodeMap).toStrictEqual({
    node1: {
      connections: [null, null, null, null],
      difficulty: 0,
      id: 'node1',
      index: 0,
      position: [0, 0],
      seed: 123_456,
    },
    node2: {
      connections: ['node1', null, null, null],
      difficulty: 1,
      id: 'node2',
      index: 0,
      position: [1, 0],
      seed: 789_012,
    },
  });
});

test('it randomizes the position of the nodes', () => {
  const compressedNodes: Array<CompressedWorldMapNode> = [
    {
      c: [null, null, null, null],
      d: 0,
      i: 0,
      id: 'node1',
      p: [1, 1],
      s: 123_456,
    },
  ];

  const result = buildWorldMapNodesByID(compressedNodes);

  expect(result['node1']?.position).not.toStrictEqual([1, 1]);
  expect(result['node1']?.position[0]).not.toBeGreaterThan(1.2);
  expect(result['node1']?.position[0]).not.toBeLessThan(0.8);
  expect(result['node1']?.position[1]).not.toBeGreaterThan(1.2);
  expect(result['node1']?.position[1]).not.toBeLessThan(0.8);
});
