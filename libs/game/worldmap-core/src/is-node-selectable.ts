import { collectNodeEdges } from './collect-node-edges';
import { ORIGIN_CELL } from './consts';
import { findCellCoord } from './find-cell-coord';
import { toNodeID } from './to-node-id';

/**
 * Whether `targetID` is in the avatar's selectable set: the origin cell (always selectable, so a
 * fresh avatar with no grants can start), every completed node (farming an already-cleared node
 * stays legal), and every node directly connected to a completed node by an edge. Reachability is
 * derived fresh from `collectNodeEdges` over the full topology rather than read from a
 * viewport-filtered graph, so a client and the server evaluating the same seed and completed set
 * always agree, including at a viewport boundary. An id `findCellCoord` can't address is never
 * selectable.
 */
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
    const [aID = '', bID = ''] = edge.id.split('|');
    const otherID = aID === targetID ? bID : aID;

    return completedNodeIDs.has(otherID);
  });
}
