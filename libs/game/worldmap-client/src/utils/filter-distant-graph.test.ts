import { expect, test } from 'bun:test';
import type { WorldEdge, WorldGraph, WorldMapNode } from '@vers/worldmap-core';
import { Object3D } from 'three';
import { filterDistanceGraph } from './filter-distant-graph';

// this data is carefully prepared in a way so that we have nodes and edges
// bordering the maximum distance in every direction along our x/y axis with
// each direction having both a node that should and shouldn't be filtered.
const mockGraph: WorldGraph = {
  edges: {
    farXNeg: createTestEdge('farXNeg', [0, -15], [0, -15.1]),
    farXPos: createTestEdge('farXPos', [0, 17], [0, 17.1]),
    farYNeg: createTestEdge('farYNeg', [-15, 0], [-15.1, 0]),
    farYPos: createTestEdge('farYPos', [17, 0], [17.1, 0]),
    nearXNeg: createTestEdge('nearXNeg', [0, -14.9], [0, -15]),
    nearXPos: createTestEdge('nearXPos', [0, 16.9], [0, 17]),
    nearYNeg: createTestEdge('nearYNeg', [-14.9, 0], [-15, 0]),
    nearYPos: createTestEdge('nearYPos', [16.9, 0], [17, 0]),
  },
  nodes: {
    farXNeg: createTestNode('farXNeg', [0, -15]),
    farXPos: createTestNode('farXPos', [0, 17]),
    farYNeg: createTestNode('farYNeg', [-15, 0]),
    farYPos: createTestNode('farYPos', [17, 0]),
    nearXNeg: createTestNode('nearXNeg', [0, -14.9]),
    nearXPos: createTestNode('nearXPos', [0, 16.9]),
    nearYNeg: createTestNode('nearYNeg', [-14.9, 0]),
    nearYPos: createTestNode('nearYPos', [16.9, 0]),
  },
};

test('it filters nodes beyond the maximum distance', () => {
  const selectedNode = new Object3D();

  // set our selected node position to something that's not the origin
  selectedNode.position.set(10, 10, 0);

  const filteredGraph = filterDistanceGraph(selectedNode, mockGraph);

  expect(filteredGraph).toStrictEqual({
    edges: {
      nearXNeg: mockGraph.edges['nearXNeg']!,
      nearXPos: mockGraph.edges['nearXPos']!,
      nearYNeg: mockGraph.edges['nearYNeg']!,
      nearYPos: mockGraph.edges['nearYPos']!,
    },
    nodes: {
      nearXNeg: mockGraph.nodes['nearXNeg']!,
      nearXPos: mockGraph.nodes['nearXPos']!,
      nearYNeg: mockGraph.nodes['nearYNeg']!,
      nearYPos: mockGraph.nodes['nearYPos']!,
    },
  });
});

function createTestNode(id: string, position: readonly [number, number]): WorldMapNode {
  return {
    connections: [null, null, null, null],
    difficulty: 0,
    id,
    index: 0,
    position,
    seed: 0,
  };
}

function createTestEdge(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
): WorldEdge {
  return {
    end,
    id,
    start,
  };
}
