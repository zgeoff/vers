import type { WorldEdge } from './types';

/**
 * Recovers the id of the node `edge` connects to `nodeID`, decoding the two endpoint ids the edge
 * id encodes as `aID|bID`. Misses with undefined when `nodeID` is neither endpoint, so a caller
 * holding an edge from another node's adjacency never silently adopts a stranger's endpoint.
 */
export function findEdgeNeighbourID(edge: WorldEdge, nodeID: string): string | undefined {
  const [aID, bID] = edge.id.split('|');

  if (aID === nodeID) {
    return bID;
  }

  return bID === nodeID ? aID : undefined;
}
