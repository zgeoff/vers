import { collectNodeEdges } from './collect-node-edges';
import { ORIGIN_CELL } from './consts';
import { findCellCoord } from './find-cell-coord';
import { findEdgeNeighbourID } from './find-edge-neighbour-id';
import { toNodeID } from './to-node-id';

export function isNodeSelectable(
  userSeed: number,
  completedNodeIDs: ReadonlySet<string>,
  targetID: string,
): boolean {
  const originID = toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]);

  if (targetID === originID) {
    return true;
  }

  if (completedNodeIDs.has(targetID)) {
    return true;
  }

  const coord = findCellCoord(targetID);

  if (coord === undefined) {
    return false;
  }

  const edges = collectNodeEdges(userSeed, coord[0], coord[1]);

  return edges.some((edge) => {
    const otherID = findEdgeNeighbourID(edge, targetID);

    return otherID !== undefined && completedNodeIDs.has(otherID);
  });
}
