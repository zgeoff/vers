import invariant from 'tiny-invariant';
import type { WorldEdge, WorldEdgesByID, WorldMapNodesByID } from './types';

export function buildWorldEdgesByID(worldMapNodes: WorldMapNodesByID): WorldEdgesByID {
  const edges: Record<string, WorldEdge> = {};

  for (const node of Object.values(worldMapNodes)) {
    for (const connection of node.connections) {
      if (connection === null) {
        continue;
      }

      const edgeKey = [node.id, connection].toSorted().join(':');
      const connectedNode = worldMapNodes[connection];

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
