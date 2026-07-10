import { expect, spyOn, test } from 'bun:test';
import { decompressAetherNodes } from './decompress-aether-nodes';
import * as getRandomizedPosition from './get-randomized-position';
import type { CompressedAetherNode } from './types';

test('it decompresses nodes into a complete aether graph', () => {
  // mock our randomization so we can assert we're getting the correct positions
  spyOn(getRandomizedPosition, 'getRandomizedPosition').mockImplementation((position) => [
    ...position,
  ]);

  const compressedNodes: Array<CompressedAetherNode> = [
    {
      c: [null, null, null, null],
      d: 0,
      i: 0,
      id: 'origin',
      p: [0, 0],
      s: 100_000,
    },
    {
      c: ['origin', null, null, null],
      d: 1,
      i: 0,
      id: 'node1',
      p: [1, 0],
      s: 200_001,
    },
    {
      c: ['origin', null, null, null],
      d: 1,
      i: 0,
      id: 'node2',
      p: [0, -1],
      s: 200_002,
    },
    {
      c: ['origin', null, null, null],
      d: 1,
      i: 0,
      id: 'node3',
      p: [-1, 0],
      s: 200_003,
    },
    {
      c: ['origin', null, null, null],
      d: 1,
      i: 0,
      id: 'node4',
      p: [0, 1],
      s: 200_004,
    },
  ];

  const graph = decompressAetherNodes(compressedNodes);

  expect(graph).toStrictEqual({
    edges: {
      'node1:origin': {
        end: [0, 0],
        id: 'node1:origin',
        start: [1, 0],
      },
      'node2:origin': {
        end: [0, 0],
        id: 'node2:origin',
        start: [0, -1],
      },
      'node3:origin': {
        end: [0, 0],
        id: 'node3:origin',
        start: [-1, 0],
      },
      'node4:origin': {
        end: [0, 0],
        id: 'node4:origin',
        start: [0, 1],
      },
    },
    nodes: {
      node1: {
        connections: ['origin', null, null, null],
        difficulty: 1,
        id: 'node1',
        index: 0,
        position: [1, 0],
        seed: 200_001,
      },
      node2: {
        connections: ['origin', null, null, null],
        difficulty: 1,
        id: 'node2',
        index: 0,
        position: [0, -1],
        seed: 200_002,
      },
      node3: {
        connections: ['origin', null, null, null],
        difficulty: 1,
        id: 'node3',
        index: 0,
        position: [-1, 0],
        seed: 200_003,
      },
      node4: {
        connections: ['origin', null, null, null],
        difficulty: 1,
        id: 'node4',
        index: 0,
        position: [0, 1],
        seed: 200_004,
      },
      origin: {
        connections: [null, null, null, null],
        difficulty: 0,
        id: 'origin',
        index: 0,
        position: [0, 0],
        seed: 100_000,
      },
    },
  });
});

test('it randomizes the position of the nodes', () => {
  const compressedNodes: Array<CompressedAetherNode> = [
    {
      c: [null, null, null, null],
      d: 0,
      i: 0,
      id: 'origin',
      p: [1, 1],
      s: 100_000,
    },
  ];

  const graph = decompressAetherNodes(compressedNodes);

  expect(graph.nodes['origin']?.position).not.toStrictEqual([1, 1]);
  expect(graph.nodes['origin']?.position[0]).not.toBeGreaterThan(1.2);
  expect(graph.nodes['origin']?.position[0]).not.toBeLessThan(0.8);
  expect(graph.nodes['origin']?.position[1]).not.toBeGreaterThan(1.2);
  expect(graph.nodes['origin']?.position[1]).not.toBeLessThan(0.8);
});
