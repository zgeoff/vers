import type { WorldEdge } from './types';

export function findEdgeNeighbourID(edge: WorldEdge, nodeID: string): string | undefined {
  const [aID, bID] = edge.id.split('|');

  if (aID === nodeID) {
    return bID;
  }

  return bID === nodeID ? aID : undefined;
}
