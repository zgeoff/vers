import { expect, test } from 'bun:test';
import { Object3D } from 'three';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { buildNearbyGraph } from './build-nearby-graph';

test('it filters nodes beyond the maximum distance', () => {
  // this data is carefully prepared in a way so that we have nodes and edges
  // bordering the maximum distance in every direction along our x/y axis with
  // each direction having both a node that should and shouldn't be filtered.
  const mockGraph: WorldGraph = {
    edges: {
      farXNeg: createMockWorldMapEdge({ end: [0, -15.1], id: 'farXNeg', start: [0, -15] }),
      farXPos: createMockWorldMapEdge({ end: [0, 17.1], id: 'farXPos', start: [0, 17] }),
      farYNeg: createMockWorldMapEdge({ end: [-15.1, 0], id: 'farYNeg', start: [-15, 0] }),
      farYPos: createMockWorldMapEdge({ end: [17.1, 0], id: 'farYPos', start: [17, 0] }),
      nearXNeg: createMockWorldMapEdge({ end: [0, -15], id: 'nearXNeg', start: [0, -14.9] }),
      nearXPos: createMockWorldMapEdge({ end: [0, 17], id: 'nearXPos', start: [0, 16.9] }),
      nearYNeg: createMockWorldMapEdge({ end: [-15, 0], id: 'nearYNeg', start: [-14.9, 0] }),
      nearYPos: createMockWorldMapEdge({ end: [17, 0], id: 'nearYPos', start: [16.9, 0] }),
    },
    nodes: {
      farXNeg: createMockWorldMapNode({ id: 'farXNeg', position: [0, -15] }),
      farXPos: createMockWorldMapNode({ id: 'farXPos', position: [0, 17] }),
      farYNeg: createMockWorldMapNode({ id: 'farYNeg', position: [-15, 0] }),
      farYPos: createMockWorldMapNode({ id: 'farYPos', position: [17, 0] }),
      nearXNeg: createMockWorldMapNode({ id: 'nearXNeg', position: [0, -14.9] }),
      nearXPos: createMockWorldMapNode({ id: 'nearXPos', position: [0, 16.9] }),
      nearYNeg: createMockWorldMapNode({ id: 'nearYNeg', position: [-14.9, 0] }),
      nearYPos: createMockWorldMapNode({ id: 'nearYPos', position: [16.9, 0] }),
    },
  };

  const selectedNode = new Object3D();

  // set our selected node position to something that's not the origin
  selectedNode.position.set(10, 10, 0);

  const filteredGraph = buildNearbyGraph(selectedNode, mockGraph);

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
