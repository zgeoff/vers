import { collectNodeEdges } from './collect-node-edges';
import { ORIGIN_CELL } from './consts';
import { findCellCoord } from './find-cell-coord';
import { findEdgeNeighbourID } from './find-edge-neighbour-id';
import { toNodeID } from './to-node-id';

export function collectSelectableNodeIDs(
  userSeed: number,
  completedNodeIDs: ReadonlySet<string>,
): ReadonlySet<string> {
  const selectable = new Set<string>([
    ...completedNodeIDs,
    toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]),
  ]);

  for (const nodeID of completedNodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined) {
      continue;
    }

    for (const edge of collectNodeEdges(userSeed, coord[0], coord[1])) {
      const neighbourID = findEdgeNeighbourID(edge, nodeID);

      if (neighbourID !== undefined) {
        selectable.add(neighbourID);
      }
    }
  }

  return selectable;
}
