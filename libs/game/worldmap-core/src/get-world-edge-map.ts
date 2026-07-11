import invariant from 'tiny-invariant';
import type { WorldEdge, WorldEdgeMap, WorldNodeMap } from './types';

export function getWorldEdgeMap(worldNodes: WorldNodeMap): WorldEdgeMap {
  const edges: Record<string, WorldEdge> = {};

  for (const node of Object.values(worldNodes)) {
    for (const connection of node.connections) {
      if (connection === null) {
        continue;
      }

      const edgeKey = [node.id, connection].toSorted().join(':');
      const connectedNode = worldNodes[connection];

      invariant(connectedNode, 'Connected node not found');

      edges[edgeKey] = {
        end: connectedNode.position,
        id: edgeKey,
        start: node.position,
      };
    }
  }

  return edges;
}
