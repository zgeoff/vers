import type { WorldEdge, WorldGraph, WorldNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';
import { Vector3 } from 'three';
import { getScenePosition } from './get-scene-position';

// i dialed this in until it looked acceptable on 1080 with the fog
const MAX_DISTANCE = 160;

/**
 * filter out nodes that are outside our camera's view to minimize
 * our scene size.
 */
export function filterDistanceGraph(
  selectedNode: null | Object3D,
  graphData: WorldGraph,
): WorldGraph {
  const position = selectedNode?.position ?? new Vector3();
  const nodes: Record<string, WorldNode> = {};

  for (const [id, node] of Object.entries(graphData.nodes)) {
    const nodePosition = new Vector3(...getScenePosition(node.position));

    const distance = position.distanceTo(nodePosition);

    if (distance <= MAX_DISTANCE) {
      nodes[id] = node;
    }
  }

  const edges: Record<string, WorldEdge> = {};

  for (const [id, edge] of Object.entries(graphData.edges)) {
    const start = new Vector3(...getScenePosition(edge.start));
    const end = new Vector3(...getScenePosition(edge.end));
    const edgeCenter = new Vector3().addVectors(start, end).multiplyScalar(0.5);

    const distance = edgeCenter.distanceTo(position);

    if (distance <= MAX_DISTANCE) {
      edges[id] = edge;
    }
  }

  return { edges, nodes };
}
