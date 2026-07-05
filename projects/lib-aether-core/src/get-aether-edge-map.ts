import invariant from 'tiny-invariant';
import type { AetherEdgeMap, AetherNodeMap } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getAetherEdgeMap(aetherNodes: AetherNodeMap): AetherEdgeMap {
  const edges: AetherEdgeMap = {};

  for (const node of Object.values(aetherNodes)) {
    for (const connection of node.connections) {
      if (connection === null) {
        continue;
      }

      const edgeKey = [node.id, connection].toSorted().join(':');
      const connectedNode = aetherNodes[connection];

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
